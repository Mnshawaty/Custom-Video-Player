'use strict';
export default function (playerInstance, options) {
    playerInstance.setupThumbnailPreviewVtt = () => {
        playerInstance.sendRequest(
            playerInstance.displayOptions.layoutControls.timelinePreview.file,
            true,
            playerInstance.displayOptions.vastOptions.vastTimeout,
            function () {
                const convertVttRawData = function (vttRawData) {
                    if (!vttRawData.length) {
                        return [];
                    }

                    const result = [];
                    let tempThumbnailData = null;
                    let tempThumbnailCoordinates = null;

                    for (let i = 0; i < vttRawData.length; i++) {
                        tempThumbnailData = vttRawData[i].text.split('#');
                        let xCoords = 0, yCoords = 0, wCoords = 122.5, hCoords = 69;

                        // .vtt file contains sprite corrdinates
                        if (
                            (tempThumbnailData.length === 2) &&
                            (tempThumbnailData[1].indexOf('xywh=') === 0)
                        ) {
                            tempThumbnailCoordinates = tempThumbnailData[1].substring(5);
                            tempThumbnailCoordinates = tempThumbnailCoordinates.split(',');

                            if (tempThumbnailCoordinates.length === 4) {
                                playerInstance.displayOptions.layoutControls.timelinePreview.spriteImage = true;
                                xCoords = parseInt(tempThumbnailCoordinates[0]);
                                yCoords = parseInt(tempThumbnailCoordinates[1]);
                                wCoords = parseInt(tempThumbnailCoordinates[2]);
                                hCoords = parseInt(tempThumbnailCoordinates[3]);
                            }
                        }

                        let imageUrl;
                        if (playerInstance.displayOptions.layoutControls.timelinePreview.spriteRelativePath
                            && playerInstance.displayOptions.layoutControls.timelinePreview.file.indexOf('/') !== -1
                            && (typeof playerInstance.displayOptions.layoutControls.timelinePreview.sprite === 'undefined' || playerInstance.displayOptions.layoutControls.timelinePreview.sprite === '')
                        ) {
                            imageUrl = playerInstance.displayOptions.layoutControls.timelinePreview.file.substring(0, playerInstance.displayOptions.layoutControls.timelinePreview.file.lastIndexOf('/'));
                            imageUrl += '/' + tempThumbnailData[0];
                        } else {
                            imageUrl = (playerInstance.displayOptions.layoutControls.timelinePreview.sprite ? playerInstance.displayOptions.layoutControls.timelinePreview.sprite : tempThumbnailData[0]);
                        }

                        result.push({
                            startTime: vttRawData[i].startTime,
                            endTime: vttRawData[i].endTime,
                            image: imageUrl,
                            x: xCoords,
                            y: yCoords,
                            w: wCoords,
                            h: hCoords
                        });
                    }

                    return result;
                };

                const xmlHttpReq = this;

                if ((xmlHttpReq.readyState === 4) && (xmlHttpReq.status !== 200)) {
                    //The response returned an error.
                    return;
                }

                if (!((xmlHttpReq.readyState === 4) && (xmlHttpReq.status === 200))) {
                    return;
                }

                const textResponse = xmlHttpReq.responseText;
                const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
                const cues = [];

                parser.oncue = (cue) => cues.push(cue);
                parser.parse(textResponse);
                parser.flush();

                playerInstance.timelinePreviewData = convertVttRawData(cues);
            }
        );
    };

    playerInstance.generateTimelinePreviewTags = () => {
        playerInstance.domRef.controls.previewContainer = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_timeline_preview_container',
            className: 'fluid_timeline_preview_container',
            style: {
                display: 'none',
                position: 'absolute',
            },
            parent: playerInstance.domRef.controls.root
        })

        playerInstance.domRef.controls.tooltipTextContainer = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_timeline_preview_tooltip_text_container',
            className: 'fluid_timeline_preview_tooltip_text_container',
            style: {
                position: 'absolute'
            },
            parent: playerInstance.domRef.controls.previewContainer
        })

        playerInstance.domRef.controls.previewTooltipText = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_timeline_preview_tooltip_text',
            className: 'fluid_timeline_preview_tooltip_text',
            style: {
                position: 'absolute'
            },
            parent: playerInstance.domRef.controls.tooltipTextContainer
        })

        //Shadow is needed to not trigger mouseleave event, that stops showing thumbnails, in case one scrubs a bit too fast and leaves current thumb before new one drawn.
        playerInstance.domRef.controls.previewContainerShadow = playerInstance.createElement({
            tag: 'div',
            id: playerInstance.videoPlayerId + '_fluid_timeline_preview_container_shadow',
            className: 'fluid_timeline_preview_container_shadow',
            style: {
                position: 'absolute',
                display: 'none',
                opacity: 1
            },
            parent: playerInstance.domRef.controls.root
        })
    };

    playerInstance.getThumbnailCoordinates = (second) => {
        if (playerInstance.timelinePreviewData.length) {
            for (let i = 0; i < playerInstance.timelinePreviewData.length; i++) {
                if ((second >= playerInstance.timelinePreviewData[i].startTime) && (second <= playerInstance.timelinePreviewData[i].endTime)) {
                    return playerInstance.timelinePreviewData[i];
                }
            }
        }

        return false;
    };

    playerInstance.drawTimelinePreview = (event) => {
        const timelinePreviewTag = playerInstance.domRef.controls.previewContainer;
        const tooltipTextContainer = playerInstance.domRef.controls.tooltipTextContainer;
        const timelinePreviewTooltipText = playerInstance.domRef.controls.previewTooltipText;
        const timelinePreviewShadow = playerInstance.domRef.controls.previewContainerShadow;
        const progressContainer = playerInstance.domRef.controls.progressContainer;
        const totalWidth = progressContainer.clientWidth;

        if (playerInstance.isCurrentlyPlayingAd) {
            if (timelinePreviewTag.style.display !== 'none') {
                timelinePreviewTag.style.display = 'none';
            }

            return;
        }

        //get the hover position
        const hoverX = playerInstance.getEventOffsetX(event, progressContainer);
        let hoverSecond = null;

        if (totalWidth) {
            hoverSecond = playerInstance.currentVideoDuration * hoverX / totalWidth;

            //get the corresponding thumbnail coordinates
            const thumbnailCoordinates = playerInstance.getThumbnailCoordinates(hoverSecond);
            timelinePreviewShadow.style.width = totalWidth + 'px';
            timelinePreviewShadow.style.display = 'block';

            if (thumbnailCoordinates !== false) {
                const progressContainer = playerInstance.domRef.controls.progressContainer;
                const totalWidth = progressContainer.clientWidth;
                // preview border is set to 2px, a total of 4px on both sides, and they are subtracted from the position of the timeline preview so that it stays within the width of the timeline
                const borderWidthPreview = parseInt(window.getComputedStyle(timelinePreviewTag, null).getPropertyValue('border-left-width').replace('px', '')) * 2;
                // add the top position to the tooltip so it is not along with the preview
                const topTooltipText = 7;
                // get the left position of the timeline
                const timelinePosition = parseInt(window.getComputedStyle(progressContainer, null).getPropertyValue('left').replace('px', ''));
                const currentPreviewPosition = hoverX - (thumbnailCoordinates.w / 2);
                const previewScrollLimitWidth = totalWidth - thumbnailCoordinates.w - borderWidthPreview;
                let previewPosition;
                if (currentPreviewPosition >= 0) {
                    if (currentPreviewPosition <= previewScrollLimitWidth) {
                        previewPosition = currentPreviewPosition + timelinePosition;
                    } else {
                        previewPosition = previewScrollLimitWidth + timelinePosition;
                    }
                } else {
                    previewPosition = timelinePosition;
                }

                timelinePreviewTag.style.width = thumbnailCoordinates.w + 'px';
                timelinePreviewTag.style.height = thumbnailCoordinates.h + 'px';
                timelinePreviewShadow.style.height = thumbnailCoordinates.h + 'px';
                timelinePreviewTag.style.background =
                    'url(' + thumbnailCoordinates.image + ') no-repeat scroll -' + thumbnailCoordinates.x + 'px -' + thumbnailCoordinates.y + 'px';
                timelinePreviewTag.style.left = previewPosition + 'px';
                timelinePreviewTag.style.display = 'block';
                tooltipTextContainer.style.top = (thumbnailCoordinates.h + topTooltipText) + 'px';
                timelinePreviewTooltipText.innerText = playerInstance.formatTime(hoverSecond);

                if (!playerInstance.displayOptions.layoutControls.timelinePreview.spriteImage) {
                    timelinePreviewTag.style.backgroundSize = 'contain';
                }
            } else {
                timelinePreviewTag.style.display = 'none';
            }
        }
    };

    playerInstance.setupThumbnailPreview = () => {
        let timelinePreview = playerInstance.displayOptions.layoutControls.timelinePreview;
        if (!timelinePreview || !timelinePreview.type || playerInstance.showCardBoardView) {
            return;
        }

        let eventOn = 'mousemove';
        let eventOff = 'mouseleave';
        if (playerInstance.mobileInfo.userOs) {
            eventOn = 'touchmove';
            eventOff = 'touchend';
        }
        playerInstance.domRef.controls.progressContainer
            .addEventListener(eventOn, playerInstance.drawTimelinePreview.bind(playerInstance), false);
        playerInstance.domRef.controls.progressContainer
            .addEventListener(eventOff, function (event) {
                const progress = playerInstance.domRef.controls.progressContainer;
                if (typeof event.clientX !== 'undefined' && progress.contains(document.elementFromPoint(event.clientX, event.clientY))) {
                    //False positive (Chrome bug when fast click causes leave event)
                    return;
                }
                playerInstance.domRef.controls.previewContainer.style.display = 'none';
                playerInstance.domRef.controls.previewContainerShadow.style.display = 'none';
            }, false);
        playerInstance.generateTimelinePreviewTags();

        if ('VTT' === timelinePreview.type && typeof timelinePreview.file === 'string') {
            import(/* webpackChunkName: "webvtt" */ 'videojs-vtt.js').then(() => {
                playerInstance.setupThumbnailPreviewVtt();
            });
        } else if ('static' === timelinePreview.type && typeof timelinePreview.frames === 'object') {
            timelinePreview.spriteImage = true;
            playerInstance.timelinePreviewData = timelinePreview.frames;
        } else {
            throw 'Invalid thumbnail-preview - type must be VTT or static';
        }

        playerInstance.showTimeOnHover = false;
    };
}

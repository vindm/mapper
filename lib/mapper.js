(function() {

    var Mapper = (function()  {


        /**
         * @param {String} layout
         * @constructor
         */
        var Mapper = function(params) {
            this.layout = params.layout || Mapper.defaultLayout;

            this.width = params.width || 0;
            this.height = params.height || 0;

            this.images = params.mappedData && params.mappedData.images || [];
        };

        Mapper.restore = function(config) {
            var mapper =  new Mapper(config.mapper),
                fitter = new Fitter(config.mappedData);

            mapper.images = config.images || fitter.images;

            function restoreBlock(parent, blockConfig) {
                var block;

                if (blockConfig.type === 'column') {
                    block = new Column(parent, fitter, blockConfig);
                } else {
                    block = new Row(parent, fitter, blockConfig);
                }

                if (block.isParent) {
                    block.items = block.items.map(function(item) {
                        return restoreBlock(block, item);
                    });
                }

                return block;
            }

            fitter.canvas = restoreBlock(fitter, fitter.canvas);

            mapper.fitter = fitter;

            return mapper;

        };

        Mapper.prototype.mapImages = function(images, params) {
            var mapper = this,
                dimensions,
                handler;

//            try {
                if ( ! Array.isArray(images)) {
                    throw new TypeError('Images are not array');
                }

                images.forEach(function(image) {
                    image.totalWidth ||
                    (image.totalWidth = image.padding[3] + image.width + image.padding[1]);
                    image.totalHeight ||
                    (image.totalHeight = image.padding[0] + image.height + image.padding[2]);
                });

                handler = Mapper['_map_' + mapper.layout];
                if (typeof handler !== 'function') {
                    handler = Mapper['_map_' + Mapper.defaultLayout];
                }

                dimensions = handler.apply(mapper, arguments);
//
//            } catch(e) {
//                console.error('Mapper Error: ', e)
//            }

            mapper.height = dimensions.height || dimensions.canvas.height || 0;
            mapper.width = dimensions.width || 0;

            return dimensions;
        };

        Mapper.defaultLayout = 'smart';

        Mapper._map_vertical = function(images) {
            return images
                .sort(function(a, b) {
                    return a.width - b.width;
                })
                .reduce(function(dimensions, image) {
                    image.positionX = 0;
                    image.positionY = dimensions.height -
                        Math.min(dimensions.prevPaddingBottom, image.padding[0]);

                    dimensions.height += image.totalHeight;
                    dimensions.prevPaddingBottom = image.padding[2];

                    image.totalWidth > dimensions.width &&
                    (dimensions.width = image.totalWidth);

                    return dimensions;
                }, {
                    width : 0, height : 0,
                    prevPaddingBottom : 0
                });
        };

        Mapper._map_horizontal = function(images) {
            return images
                .sort(function(a, b) {
                    return a.height - b.height;
                })
                .reduce(function(dimensions, image) {
                    image.positionY = 0;
                    image.positionX = dimensions.width -
                        Math.min(dimensions.prevPaddingRight, image.padding[3]);

                    dimensions.width += image.totalWidth;
                    dimensions.prevPaddingRight = image.padding[1];

                    image.height > dimensions.height &&
                    (dimensions.height = image.totalHeight);

                    return dimensions;
                }, {
                    width : 0, height : 0,
                    prevPaddingRight : 0
                });
        };

        Mapper._map_diagonal = function(images) {
            return images
                .sort(function(a, b) {
                    return a.width * a.height - b.width * b.height;
                })
                .reduce(function(dimensions, image) {
                    image.positionX = dimensions.width -
                        Math.min(dimensions.prevPaddingRight, image.padding[3]);
                    image.positionY = dimensions.height -
                        Math.min(dimensions.prevPaddingBottom, image.padding[0]);

                    dimensions.width += image.totalWidth;
                    dimensions.height += image.totalHeight;
                    dimensions.prevPaddingRight = image.padding[1];
                    dimensions.prevPaddingBottom = image.padding[2];

                    return dimensions;
                }, {
                    width : 0, height : 0,
                    prevPaddingRight : 0,
                    prevPaddingBottom : 0
                });
        };

        Mapper._map_smart = function(images, params) {
            var fitter = new Fitter(params, images);

            fitter.fit();
            fitter.width = fitter.canvas.width;
            fitter.height = fitter.canvas.height;

            return fitter;
        };


        /**
         * @param {Array} images
         * @constructor
         */
        var Fitter = Mapper.Fitter = function(params, images) {
            this.canvas = params && params.canvas || new Block('column', this, this);
            this.good_width = 1000;
            this.good_height = 1000;

            if (params) {
                this.minWidth = params.min_width;
                this.maxWidth = params.max_width;
                this.maxHeight = params.max_height;
            }
            this.deep_level = params && params.deep_level || 5;
            this.allowed_diff = params && params.allowed_diff || 100;

            this.images = images ?
                images.sort(function(a, b) {
                    var ath = a.totalHeight,
                        atw = a.totalWidth,
                        bth = b.totalHeight,
                        btw = b.totalWidth,
                        ah = atw * ath + ath * ath,
                        aw = atw * ath + atw * atw,
                        bh = btw * bth + bth * bth,
                        bw = btw * bth + btw * btw;

                    return ah === bh ?
                        bw - aw :
                        bh - ah;
                }) :
                [];

            this.update();
        };

        Fitter.prototype.update = function() {
            console.time('update props');
            this.canvas._update();
            console.timeEnd('update props');
        };

        Fitter.prototype.checkEfficiency = function(elem, image) {
            var parent = image.parent,
                width,
                height;

            elem.add(image);

            width = this.canvas.width;
            height = this.canvas.height;

            elem.remove(elem.items.length - 1);
            image.parent = parent;

            return (height * height + width * width);
        };

        Fitter.prototype.getBestLayout = function() {
            var good = this.minWidth / this.maxWidth,
                std,
                curSquare,
                bestSquare,
                bestLayout;

            //            for (good = 0; good <= 1; good += 0.1) {
            //                GOOF_WIDTH_DIFF = good;
            //
                            for (std = 0; std <= 100; std += 5) {
                                this.allowed_diff = std;
                                this.canvas.items = [];

                                this.update();
                                this.fast_fit();

                                curSquare = this.canvas.width * this.canvas.height;
                                    console.log(this.allowed_diff, curSquare, bestSquare)

                                if ( ! bestSquare || bestSquare > curSquare) {
                                    bestSquare = curSquare;
                                    bestLayout = this.canvas.items;
                                }
                            }
            //            }
            this.canvas.items = bestLayout;
            this.update();
        };

        Fitter.prototype.fit = function() {
            this.getBestLayout();
            this.map();
        };

        Fitter.prototype.fast_fit = function() {
            var canvas = this.canvas,
                images = this.images;

            console.time('fast_fit')
            images.forEach(function(image, i) {
//                console.time('_getFittestBlock');
                var elem = canvas._getFittestBlock(image);

//                console.timeEnd('_getFittestBlock');

                if(elem) {
                    elem.add(image);
                }
            });
            console.timeEnd('fast_fit')

        };

        Fitter.prototype.scan_fit = function() {
            var canvas = this.canvas,
                blocks,
                blocksCount,
                acceptor,
                acceptorInd,
                donor,
                donorInd,
                donorImages,
                donorImagesCount,
                image,
                imageInd,
                fittestBlock,
                isChanged,
                changedImages = [];

            this.fast_fit();

            do {
                blocks = canvas.items;
                blocksCount = blocks.length;
                isChanged = false;

                for (acceptorInd = 0; acceptorInd < blocksCount; acceptorInd += 1) {
                    acceptor = blocks[acceptorInd];

                    for (donorInd = acceptorInd + 1; donorInd < blocksCount; donorInd += 1) {
                        donor = blocks[donorInd];
                        donorImages = donor.images;
                        donorImagesCount = donorImages.length;

                        for (imageInd = donorImagesCount - 1; imageInd >= 0; imageInd -= 1) {
                            image = donorImages[imageInd];

                            if (changedImages.indexOf(image.id) !== -1) {
                                continue;
                            }

                            fittestBlock = acceptor._getFittestBlock(image);
                            if (fittestBlock) {
                                var parent = image.parent;
                                parent.remove(image);

                                donorImagesCount -= 1;

                                fittestBlock.add(image);
                                changedImages.push(image.id);
                                isChanged = true;
                            }
                        }
                    }
                }

            } while(isChanged);
        };

        Fitter.prototype.map = function() {
            var images = [];

            function mapColumn(column, pos) {
                column.items
                    .reduce(function(rowPos, row) {
                        var rowPadding = row.padding;

                        rowPos.y -= (rowPos.prevPaddingBottom < rowPadding[0] ?
                            rowPos.prevPaddingBottom :
                            rowPadding[0]);

                        row.isParent ?
                            mapRow(row, { x : rowPos.x, y : rowPos.y }) :
                            mapRowImages(row, rowPos);

                        rowPos.y += row.totalHeight;
                        rowPos.prevPaddingBottom = rowPadding[2];

                        return rowPos;
                    }, {
                        x : pos.x,
                        y : pos.y,
                        prevPaddingBottom : 0
                    });
            }

            function mapColumnImages(column, columnPos) {
                column.items
                    .reduce(function(imagePos, image) {
                        var imagePadding = image.padding;

                        image.positionX = columnPos.x;
                        image.positionY = imagePos.y - (imagePos.prevPaddingBottom < imagePadding[0] ?
                            imagePos.prevPaddingBottom :
                            imagePadding[0]);

                        images.push(image);

                        imagePos.y = image.positionY + image.totalHeight;
                        imagePos.prevPaddingBottom = imagePadding[2];

                        return imagePos;
                    }, {
                        x : columnPos.x,
                        y : columnPos.y,
                        prevPaddingBottom : 0
                    });
            }

            function mapRow(row, pos) {
                row.items
                    .reduce(function(columnPos, column) {
                        var columnPadding = column.padding;

                        columnPos.x -= (columnPos.prevPaddingRight < columnPadding[3] ?
                            columnPos.prevPaddingRight :
                            columnPadding[3]);

                        column.isParent ?
                            mapColumn(column, { x : columnPos.x, y : columnPos.y }) :
                            mapColumnImages(column, columnPos);

                        columnPos.x += column.totalWidth;
                        columnPos.prevPaddingRight = columnPadding[1];

                        return columnPos;
                    }, {
                        x : pos.x,
                        y : pos.y,
                        prevPaddingRight : 0
                    });
            }

            function mapRowImages(row, rowPos) {
                row.items
                    .reduce(function(imagePos, image) {
                        var imagePadding = image.padding;

                        image.positionY = imagePos.y;
                        image.positionX = imagePos.x - (imagePos.prevPaddingRight < imagePadding[3] ?
                            imagePos.prevPaddingRight :
                            imagePadding[3]);

                        images.push(image);

                        imagePos.x = image.positionX + image.totalWidth;
                        imagePos.prevPaddingRight = imagePadding[1];

                        return imagePos;
                    }, {
                        x : rowPos.x,
                        y : rowPos.y,
                        prevPaddingRight : 0
                    });
            }

            this.canvas.isParent ?
                mapColumn(this.canvas, { x : 0, y : 0 }) :
                mapColumnImages(this.canvas, { x : 0, y : 0 });

            return images;
        };


        /**
         *
         * @param parent
         * @param fitter
         * @constructor
         */
        var Block = function(type, parent, fitter, params) {
            this.type = type;

            Object.defineProperties(this, {
                fitter : {
                    get : function() {
                        return fitter;
                    }
                },
                parent : {
                    get : function() {
                        return parent;
                    }
                }
            });

            if (params) {
                this.deep = params.deep;
                this.items = params.items;
            } else {
                this.deep = (parent.deep || 0) + 1;
                this.items = [];
            }
        };

        Object.defineProperties(
            Block.prototype, {
                isParent : {
                    get : function() {
                        return this.deep && this.deep < this.fitter.deep_level;
                    },
                    enumerable : true
                },
                childType : {
                    get : function() {
                        return this.type === 'column' ?
                            'row' :
                            'column';
                    },
                    enumerable: true
                }
            }
        );

        Block.prototype.add = function(child) {
            var block = this,
                newBlock;

            if (block.isParent) {
                newBlock = block._newBlock();
                child && newBlock.add(child);
            } else {
                child.parent ?
                    child.parent = block :
                    Object.defineProperty(child, 'parent', { get : function() { return block } });

                newBlock = child;
            }

            block.items.push(newBlock);

            block.fitter.update();
        };

        Block.prototype.remove = function(index) {
            var block = this,
                removed;

            removed = block.items.splice(index, 1);
            removed.parent = null;

            block.fitter.update();

            return removed;
        };

        Block.prototype._update = function() {
            if (this.isParent) {
                this.items.forEach(function(child) {
                    child._update();
                });
            }

            this.images = this._getImages();
            this.padding = this._getPadding();
            this.width = this._getWidth();
            this.maxWidth = this._getMaxWidth();
            this.totalWidth = this._getTotalWidth();
            this.height = this._getHeight();
            this.maxHeight = this._getMaxHeight();
            this.totalHeight = this._getTotalHeight();
        };

        Block.prototype._newBlock = function() {
            return new Block(this.childType, this, this.fitter);
        };

        Block.prototype._getFittestBlock = function(image) {
            var block = this,
                fittestBlock,
                found,
                childEfficiency,
                myEfficiency;

            if (block.isParent) {
                found = block._willChildrenFit(image);
                if (found && found.elem) {
                    fittestBlock = found.elem;
                    childEfficiency = found.efficiency;
                }
            }

            if (block._willFit(image)) {
                if (fittestBlock) {
                    myEfficiency = block.fitter.checkEfficiency(block, image);
                    if (childEfficiency >= myEfficiency) {
                        fittestBlock = block;
                    }
                } else {
                    fittestBlock = block;
                }
            }

            return fittestBlock;
        };

        Block.prototype._willChildrenFit = function(image) {
            var block = this,
                fitter = block.fitter;

            return block.items.reduce(function(bestFit, child) {
                var elem = child._getFittestBlock(image);

                if (elem) {
                    var efficiency = fitter.checkEfficiency(elem, image);

                    if ( ! bestFit.efficiency || bestFit.efficiency > efficiency) {
                        bestFit.efficiency = efficiency;
                        bestFit.elem = elem;
                    }
                }

                return bestFit;
            }, {
                efficiency : null,
                elem : false
            });

        };

        Block.prototype._willFit = function(image) {
            var maxH = this.maxHeight,
                maxW = this.maxWidth,
                hDiff = maxH - (this.type === 'column' ? this.totalHeight : 0) - image.totalHeight,
                wDiff = maxW - (this.type === 'row' ? this.totalWidth : 0) - image.totalWidth,
                hDiffPerc = Math.abs(hDiff) * 100 / maxH,
                wDiffPerc = Math.abs(wDiff) * 100 / maxW,
                hDiffAllowed,
                wDiffAllowed;

            hDiffAllowed = ! maxH || hDiff >= 0 ||
                (hDiffPerc < this.fitter.allowed_diff);

            wDiffAllowed = ! maxW || wDiff >= 0 ||
                (wDiffPerc < this.fitter.allowed_diff);

            return hDiffAllowed && wDiffAllowed;
        };

        Block.prototype._getImages = function() {
            return ! this.isParent ?
                this.items :
                this.items
                    .reduce(function(images, item) {
                        images = images.concat(item.images);
                        return images;
                    }, []);
        };

        Block.prototype._getPadding = function() {
            var block = this,
                items = this.items,
                len = items.length,
                padding = [
                    0, items[0] ? items[0].padding[1] : 0,
                    0, items[0] ? items[items.length - 1].padding[3] : 0
                ];

            items.reduce(function(max, item) {
                var dimension = item[block.type === 'row' ? 'totalHeight' : 'totalWidth'];

                if (dimension > max) {
                    padding = item.padding;

                    max = dimension;
                }

                return max;
            }, 0);

            if (block.type === 'row') {
                padding[1] = len ? items[0].padding[1] : 0;
                padding[3] = len ? items[len - 1].padding[3] : 0;
            } else {
                padding[0] = len ? items[0].padding[0] : 0;
                padding[2] = len ? items[len - 1].padding[2] : 0;
            }

            return padding;
        };

        Block.prototype._getWidth = function() {
            return this.type === 'column' ?
                this.items
                    .reduce(function(lastMaxWidth, item) {
                        var itemWidth = item.totalWidth;

                        return itemWidth > lastMaxWidth ?
                            itemWidth :
                            lastMaxWidth;
                    }, 0) :
                this.items
                    .reduce(function(sum, item) {
                        var itemPadding = item.padding;

                        sum.total += item.totalWidth -
                            (sum.prevPaddingRight < itemPadding[3] ? sum.prevPaddingRight : itemPadding[3]);

                        sum.prevPaddingRight = itemPadding[1];

                        return sum;
                    }, {
                        total : 0,
                        prevPaddingRight : 0
                    })
                    .total;
        };

        Block.prototype._getMaxWidth = function() {
            return this.parent.good_width ||
                (this.type === 'row' ? this.parent.maxWidth : this.width) ||
                0;
        };

        Block.prototype._getTotalWidth = function() {
            return this.width;
        };

        Block.prototype._getHeight = function() {
            return this.type === 'row' ?
                this.items
                    .reduce(function(lastMaxHeight, item) {
                        var itemHeight = item.totalHeight;

                        return itemHeight > lastMaxHeight ?
                            itemHeight :
                            lastMaxHeight;
                    }, 0) :
                this.items
                    .reduce(function(sum, item) {
                        var itemPadding = item.padding;

                        sum.total += item.totalHeight -
                            (sum.prevPaddingBottom < itemPadding[0] ? sum.prevPaddingBottom : itemPadding[0]);

                        sum.prevPaddingBottom = itemPadding[2];

                        return sum;
                    }, {
                        total : 0,
                        prevPaddingBottom : 0
                    })
                    .total;
        };

        Block.prototype._getMaxHeight = function() {
            return this.parent.good_height ||
                (this.type === 'column' ? this.parent.maxHeight : this.height) ||
                0;
        };

        Block.prototype._getTotalHeight = function() {
            return this.height;
        };


        return Mapper;
    })();

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = Mapper;
    } else {
        if (typeof define === 'function' && define.amd) {
            define([], function() {
                return Mapper;
            });
        } else {
            window.Mapper = Mapper;
        }
    }

})();

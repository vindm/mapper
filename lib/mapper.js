(function() {

    var Mapper = (function()  {


        /**
         * @param {String} layout
         * @constructor
         */
        var Mapper = function(config) {
            this.layout = config.layout || Mapper.defaultLayout;
            this.width = config.width || 0;
            this.height = config.height || 0;
        };

        Mapper.restore = function(config) {
            var mapper = new Mapper(config),
                fitter = Fitter.restore(config.fitter);

            mapper.fitter = fitter;
            mapper.images = fitter.canvas.images;

            return mapper;

        };

        Mapper.defaultLayout = 'smart';

        Mapper.prototype.mapImages = function(images, config) {
            var mapper = this,
                dimensions,
                handler;

            try {
                if ( ! Array.isArray(images)) {
                    throw new TypeError('Images are not array');
                }

                images.forEach(function(image) {
                    var p = image.padding;

                    image.totalWidth ||
                    (image.totalWidth = p ? p[3] : 0 + image.width + p ? p[1] : 0);
                    image.totalHeight ||
                    (image.totalHeight = p ? p[0] : 0 + image.height + p ? p[2] : 0);
                });

                handler = Mapper['_map_' + mapper.layout];
                if (typeof handler !== 'function') {
                    handler = Mapper['_map_' + Mapper.defaultLayout];
                }

                dimensions = handler.apply(mapper, arguments);

            } catch(e) {
                console.error('Mapper Error: ', e, e.stack)
            }

            mapper.height = dimensions.height || dimensions.canvas.height || 0;
            mapper.width = dimensions.width || 0;

            return dimensions;
        };

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
            var fitter;

            params || (params = {});
            params.good_width =  Math.sqrt(images.reduce(function(s, o) {
                return [
                    s[0] + o.totalWidth * o.totalHeight
                ];
            }, [ 0, 0 ])) * 1.5;

            fitter = new Fitter(params, images);

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
            params || (params = {});

            this.canvas = params.canvas || new Block('column', this, this);

            if (params) {
                this.minWidth = params.minWidth;
                this.maxWidth = params.maxWidth;
                this.maxHeight = params.maxHeight;
            }
            this.deep_level = params.deep_level || 9;
            this.allowed_diff = params.allowed_diff || 100;
            this.good_height = params.good_height || this.maxHeight;
            this.good_width = params.good_width || this.maxWidth;

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
        };

        Fitter.restore = function(config) {
            var fitter = new Fitter(config);

            function restoreBlock(parent, blockConfig) {
                var block;

                if (blockConfig.type) {
                    block = new Block(blockConfig.type, parent, fitter, blockConfig);
                    block.items = block.items.map(function(item) {
                        return restoreBlock(block, item);
                    });
                } else {
                    block = blockConfig;
                    Object.defineProperty(block, 'parent', { value : parent });
                }

                return block;
            }

            fitter.canvas = restoreBlock(fitter, config.canvas);
            fitter._fullUpdate();

            return fitter;
        };

        Fitter.prototype.fit = function() {
            this.canvas.items = [];
            this.canvas._update();
            this.canvas._fast_fit(this.images);
            //            this._getBestLayout();
            this.map();
        };

        Fitter.prototype.map = function() {
            this.canvas.map({ x : 0, y : 0 });

            return this.canvas.images;
        };

        Fitter.prototype._update = function() {};

        Fitter.prototype._fullUpdate = function() {
            this.canvas._update_capture();
        };

        Fitter.prototype._getBestLayout = function() {
            var start_deep = this.deep_level,
                std,
                curSquare,
                bestSquare,
                best;

            for (var deep = 2; deep <= start_deep; deep += 1) {
                this.deep_level = deep;

                for (std = 0; std <= 100; std += 20) {
                    this.allowed_diff = std;

                    this.canvas.items = [];
                    this.canvas._update();
                    this.canvas._fast_fit(this.images);

                    curSquare = this.canvas.width * this.canvas.height;

                    if ( ! bestSquare || bestSquare > curSquare) {
                        bestSquare = curSquare;
                        best = {
                            layout : this.canvas.items,
                            deep_level : deep,
                            allowed_diff : std
                        }
                    }
                }
            }

            this.deep_level = best.deep_level;
            this.allowed_diff = best.allowed_diff;
            this.canvas.items = best.layout;
            this.canvas._update();
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
                    },
                    enumerable: false
                },
                parent : {
                    get : function() {
                        return parent;
                    },
                    enumerable: false
                },
                images : {
                    enumerable : false,
                    writable : true
                },
                padding : {
                    enumerable : false,
                    writable : true
                },
                width : {
                    enumerable : false,
                    writable : true
                },
                height : {
                    enumerable : false,
                    writable : true
                }
            });

            if (params) {
                this.deep = params.deep;
                this.items = params.items;
            } else {
                this.deep = (parent.deep || 0) + 1;
                this.items = [];
            }
            this.padding = params && params.padding || [0,0,0,0];
        };

        Object.defineProperties(
            Block.prototype, {
                isParent : {
                    get : function() {
                        return this.deep && this.deep < this.fitter.deep_level;
                    },
                    enumerable : false
                },
                childType : {
                    get : function() {
                        return this.type === 'column' ?
                            'row' :
                            'column';
                    },
                    enumerable: false
                },
                maxWidth : {
                    get : function() {
                        return this._getMaxWidth();
                    },
                    enumerable: false
                },
                totalWidth : {
                    get : function() {
                        return this._getTotalWidth();
                    },
                    enumerable: false
                },
                maxHeight : {
                    get : function() {
                        return this._getMaxHeight();
                    },
                    enumerable: false
                },
                totalHeight : {
                    get : function() {
                        return this._getTotalHeight();
                    },
                    enumerable: false
                }
            }
        );

        Block.prototype.add = function(child) {
            var block = this,
                newBlock;

            if (block.isParent) {
                newBlock = block._newBlock();
                newBlock.add(child);
            } else {
                if ( ! Object.getOwnPropertyDescriptor(child, 'parent')) {
                    Object.defineProperty(child, 'parent', {
                        value : block,
                        writable : true
                    });
                } else {
                    child.parent = block;
                }

                newBlock = child;
            }

            block.items.push(newBlock);
            block._update();
        };

        Block.prototype.remove = function(child) {
            var block = this,
                index,
                removed;

            index = typeof child === 'number' ?
                child :
                block.items.indexOf(child);

            if (index !== -1) {
                removed = block.items.splice(index, 1);
                removed.parent = null;

                block._update();
            }
        };

        Block.prototype.fit = function(images) {
            this._fast_fit(images);
        };

        Block.prototype.map = function(startPosition) {
            var block = this,
                type = block.type,
                isColumn = type === 'column',
                isRow = type === 'row';

            block.items
                .reduce(function(childPos, child) {
                    var childPadding = child.padding;

                    childPos.x -= isRow ?
                        (childPos.prevPaddingRight < childPadding[3] ?
                            childPos.prevPaddingRight :
                            childPadding[3]) :
                        0;
                    childPos.y -= isColumn ?
                        (childPos.prevPaddingBottom < childPadding[0] ?
                            childPos.prevPaddingBottom :
                            childPadding[0]) :
                        0;

                    if (child.type) {
                        child.map(childPos);
                    } else {
                        child.positionX = childPos.x;
                        child.positionY = childPos.y;
                    }

                    childPos.x += isRow ? child.totalWidth : 0;
                    childPos.y += isColumn ? child.totalHeight : 0;
                    childPos.prevPaddingRight = childPadding[1];
                    childPos.prevPaddingBottom = childPadding[2];

                    return childPos;
                }, {
                    x : startPosition.x,
                    y : startPosition.y,
                    prevPaddingRight : 0,
                    prevPaddingBottom : 0
                });
        };

        Block.prototype.checkEfficiency = function(child) {
            var block = this,
                childParent = child.parent,
                width,
                height;

            block.add(child);

            width = block.fitter.canvas.width;
            height = block.fitter.canvas.height;

            block.remove(block.items.length - 1);
            child.parent = childParent;

            return (height * height + width * width);
        };

        Block.prototype._fast_fit = function(images) {
            var block = this;

            images.forEach(function(image) {
                var elem = block._getFittestBlock(image);

                if (elem) {
                    elem.add(image);
                }
            });
        };

        Block.prototype._scan_fit = function() {
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

            this._fast_fit();

            do {
                canvas._update();
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

                            var imageParent = image.parent;

                            fittestBlock = acceptor._getFittestBlock(image);

                            if (fittestBlock) {
                                image.parent.remove(image);
                                fittestBlock.add(image);

                                changedImages.push(image.id);
                                isChanged = true;
                            }

                            if ( ! imageParent.images.length) {
                                imageParent.parent.remove(imageParent);
                            }
                        }
                    }
                }

            } while(isChanged);
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
                    myEfficiency = block.checkEfficiency(image);
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
            var block = this;

            return block.items.reduce(function(bestFit, child) {
                var elem = child._getFittestBlock(image);

                if (elem) {
                    var efficiency = elem.checkEfficiency(image);

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

        Block.prototype._update_capture = function() {
            if (this.isParent) {
                this.items.forEach(function(child) {
                    child._update_capture();
                });
            }

            this.images = this._getImages();
            this.padding = this._getPadding();
            this.width = this._getWidth();
            this.height = this._getHeight();
        };

        Block.prototype._update = function() {
            this.images = this._getImages();
            this.width = this._getWidth();
            this.height = this._getHeight();
            this.padding = this._getPadding();

            this.parent._update();
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
                type = block.type,
                isColumn = type === 'column',
                isRow = type === 'row',
                items = this.items,
                len = items.length,
                padding = [ 0, 0, 0, 0 ],
                padding2 = [ 0, 0, 0, 0 ],
                data;

            if ( ! len) {
                return padding2;
            }

            if (isRow) {
                data = items.reduce(function(max, item) {
                    if ( ! max.minTopPadding || item.padding[0] < max.minTopPadding) {
                        max.minTopPadding = item.padding[0];
                    }

                    if (item.totalHeight - item.padding[2] > max.maxHeight) {
                        max.maxHeight = item.totalHeight - item.padding[2];
                    }

                    return max;
                }, {
                    minTopPadding : null,
                    maxHeight: 0
                });

                padding2[0] = data.minTopPadding;
                padding2[1] = items[len - 1].padding[1];
                padding2[2] = block.totalHeight - data.maxHeight;
                padding2[3] = items[0].padding[3];
            } else {
                data = items.reduce(function(max, item) {
                    if ( ! max.minLeftPadding || item.padding[3] < max.minLeftPadding) {
                        max.minLeftPadding = item.padding[3];
                    }

                    if (item.totalWidth - item.padding[1] > max.maxWidth) {
                        max.maxWidth = item.totalWidth - item.padding[1];
                    }

                    return max;
                }, {
                    minLeftPadding : null,
                    maxWidth: 0
                });

                padding2[0] = items[0].padding[0];
                padding2[1] = block.totalWidth - data.maxWidth;
                padding2[2] = items[len - 1].padding[2];
                padding2[3] = data.minLeftPadding;
            }

            return padding2;
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

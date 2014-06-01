(function() {

    var Mapper = (function()  {

        /**
         * @constructor
         * @param {Object} config
         */
        var Fitter = function(config) {
            var canvas,
                type,
                deep;

            this.layout = config.layout || 'smart';
            this.padding = config.padding || [ 0, 0, 0, 0];

            if ( ! config.canvas) {
                type = 'column';
                deep = 1;

                if (this.layout === 'horizontal') {
                    type = 'row';
                } else if (this.layout === 'smart') {
                    deep = 9;
                }

                canvas = Block.create({ type : type, deep : deep }, null, this);
            } else {
                canvas = Block.restore(config.canvas, null, this);
            }

            canvas._update(true);
            this.canvas = canvas;

            Object.defineProperties(
                this, {
                    width : {
                        get : function() {
                            return this.canvas && this.canvas.width;
                        },
                        enumerable : true
                    },
                    height : {
                        get : function() {
                            return this.canvas && this.canvas.height;
                        },
                        enumerable : true
                    },
                    maxWidth : {
                        writable : true,
                        enumerable : false
                    },
                    maxHeight : {
                        writable : true,
                        enumerable : false
                    },
                    allowed_diff : {
                        writable : true,
                        enumerable : false
                    }
                }
            );
        };

        Fitter._getItemsDimensions = function(items) {
            Array.isArray(items) || (items = [ items ]);

            return items.reduce(function(sum, item) {
                return {
                    sumSquare : sum.sumSquare + item.totalWidth * item.totalHeight,
                    sumWidth : sum.sumWidth + item.totalWidth,
                    sumHeight : sum.sumHeight + item.totalHeight,
                    minHeight : Math.min(item.height, sum.minHeight),
                    maxHeight : Math.max(item.height, sum.maxHeight),
                    minWidth : Math.min(item.width, sum.minWidth),
                    maxWidth : Math.max(item.width, sum.maxWidth)
                };
            }, {
                sumSquare : 0,
                sumWidth : 0,
                sumHeight : 0,
                minHeight : Infinity,
                maxHeight : 0,
                minWidth : Infinity,
                maxWidth : 0
            });
        };

        Fitter._sort_for_horizontal = function(items) {
            return items.sort(function(a, b) {
                var ath = a.totalHeight,
                    atw = a.totalWidth,
                    bth = b.totalHeight,
                    btw = b.totalWidth,
                    diff;

                diff = ath - bth;
                if (diff === 0) {
                    diff = btw - atw;
                    if (diff === 0) {
                        diff = a.num - b.num;
                    }
                }

                return -diff;
            });
        };

        Fitter._sort_for_vertical = function(items) {
            return items.sort(function(a, b) {
                var ath = a.totalHeight,
                    atw = a.totalWidth,
                    bth = b.totalHeight,
                    btw = b.totalWidth,
                    diff;

                diff = atw - btw;
                if (diff === 0) {
                    diff = ath - bth;
                    if (diff === 0) {
                        diff = a.num - b.num;
                    }
                }

                return -diff;
            });
        };

        Fitter._sort_for_smart = function(items) {
            return items.sort(function(a, b) {
                var ath = a.totalHeight,
                    atw = a.totalWidth,
                    bth = b.totalHeight,
                    btw = b.totalWidth,
                    ah = atw * ath + ath * ath,
                    aw = atw * ath + atw * atw,
                    bh = btw * bth + bth * bth,
                    bw = btw * bth + btw * btw,
                    diff;

                diff = ah - bh;
                if (diff === 0) {
                    diff = bw - aw;
                    if (diff === 0) {
                        diff = a.num - b.num;
                    }
                }

                return -diff;
            });
        };

        Fitter.prototype.add = function(items) {

            items = [].concat(this.items || [], items);

            var canvas = this.canvas,
                dims = Fitter._getItemsDimensions(items),
                maxWidth,
                maxHeight;

            if (this.layout === 'vertical') {
                maxWidth = dims.maxWidth;
                maxHeight = dims.sumHeight;
            } else if (this.layout ===  'horizontal') {
                maxWidth = dims.sumWidth;
                maxHeight = dims.maxHeight;
            } else {
                maxWidth = maxHeight = Math.sqrt(dims.sumSquare) * 2;
            }

            this.maxWidth = maxWidth;
            this.maxHeight = maxHeight;
            this.allowed_diff = 10;

            canvas.drop();

            this._add(items);

            return this;
        };

        Fitter.prototype.safeAdd = function(items) {
            var canvas = this.canvas,
                dims = Fitter._getItemsDimensions(items),
                maxWidth,
                maxHeight;

            if (canvas.deep < 2) {
                if (canvas.type === 'column') {
                    maxWidth = dims.maxWidth;
                    maxHeight = dims.sumHeight;
                } else if (canvas.type === 'row') {
                    maxWidth = dims.sumWidth;
                    maxHeight = dims.maxHeight;
                }
            } else {
                maxWidth = maxHeight = Math.sqrt(canvas.totalWidth * canvas.totalHeight + dims.sumSquare) * 2;
            }

            this.maxWidth = maxWidth;
            this.maxHeight = maxHeight;
            this.allowed_diff = 0;

            this._add(items);

            return this;
        };

        Fitter.prototype.remove = function(items) {
            Array.isArray(items) || (items = [ items ]);

            this.items && this.items.forEach(function(image) {
                if (items.indexOf(image) !== -1) {
                    image.parent.remove(image);
                }
            });
        };

        Fitter.prototype.map = function() {
            this.canvas.map();

            return this.items;
        };

        Fitter.prototype._add = function(items) {
            Array.isArray(items) || (items = [ items ]);

            Fitter['_sort_for_' + this.layout](items);

            this.canvas._update(true);

            items.forEach(function(item) {
                this._prepareItem(item);
                this._forceAdd(item);
            }, this);

            return this;
        };

        Fitter.prototype._forceAdd = function(item) {
            if ( ! this.canvas.add(item)) {
                this.maxHeight += item.totalHeight;
                this.maxWidth += item.totalWidth;

                this._forceAdd(item);
            }
        };

        Fitter.prototype._prepareItem = function(item) {
            item.padding || (item.padding = this.padding);
            item.totalWidth = item.padding[3] + item.width + item.padding[1];
            item.totalHeight = item.padding[0] + item.height + item.padding[2];
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

                    this.canvas.fit(this.items);

                    curSquare = this.canvas.width * this.canvas.height;

                    if ( ! bestSquare || bestSquare > curSquare) {
                        bestSquare = curSquare;
                        best = {
                            layout : this.canvas.children,
                            deep_level : deep,
                            allowed_diff : std
                        };
                    }
                }
            }

            this.deep_level = best.deep_level;
            this.allowed_diff = best.allowed_diff;
            this.canvas.children = best.layout;
            this.canvas._update();
        };

        Object.defineProperties(
            Fitter.prototype, {
                items : {
                    get : function() {
                        return this.canvas && this.canvas.items;
                    }
                }
            }
        );

        /**
         * @constructor
         */
        var Block = function(config, parent, fitter) {
            config || (config = {});

            this.type = config.type || 'column';
            this.deep = config.deep || ((parent && parent.deep || 2) - 1);
            this.padding = config.padding || [ 0, 0, 0, 0 ];
            this.children = config.children || [];

            Object.defineProperties(this, {
                fitter : {
                    get : function() {
                        return fitter || (parent && parent.fitter) || this;
                    },
                    enumerable : false
                },
                parent : {
                    get : function() {
                        return parent || null;
                    },
                    enumerable : false
                },
                items : {
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
        };

        Block.create = function(config, parent, fitter) {
            var block;

            if (config.type) {
                block = new Block(config, parent, fitter);
            } else {
                block = config;
                Object.defineProperty(block, 'parent', { value : parent });
            }

            return block;
        };

        Block.restore = function(config, parent, fitter) {
            var block;

            if (config.type) {
                block = new Block(config, parent, fitter);
                block.children = block.children.map(function(child) {
                    return Block.restore(child, block, fitter);
                });
            } else {
                block = config;
                Object.defineProperty(block, 'parent', { value : parent });
            }

            return block;
        };

        Object.defineProperties(
            Block.prototype, {
                isParent : {
                    get : function() {
                        return this.deep && this.deep > 1;
                    },
                    enumerable : false
                },
                childType : {
                    get : function() {
                        return this.type === 'column' ?
                            'row' :
                            'column';
                    },
                    enumerable : false
                },
                maxWidth : {
                    get : function() {
                        return this._getMaxWidth();
                    },
                    enumerable : false
                },
                totalWidth : {
                    get : function() {
                        return this._getTotalWidth();
                    },
                    enumerable : false
                },
                maxHeight : {
                    get : function() {
                        return this._getMaxHeight();
                    },
                    enumerable : false
                },
                totalHeight : {
                    get : function() {
                        return this._getTotalHeight();
                    },
                    enumerable : false
                }
            }
        );

        Block.prototype.add = function(item) {
            var block = this,
                elem = block._getFittestBlock(item),
                isAdded = false;

            if (elem) {
                elem._addDeclaration(item);
                isAdded = true;
            }

            return isAdded;
        };

        Block.prototype.remove = function(item) {
            var block = this,
                index,
                removed;

            index = typeof item === 'number' ?
                item :
                block.children.indexOf(item);

            if (index !== -1) {
                removed = block.children.splice(index, 1);
                removed.parent = null;

                block._update();
            }
        };

        Block.prototype.drop = function() {
            this.children = [];
            this._update();
        };

        Block.prototype.map = function(startPosition) {
            var block = this,
                type = block.type,
                isColumn = type === 'column',
                isRow = type === 'row';

            startPosition || (startPosition = { x : 0, y : 0 });

            block.children
                .reduce(function(childPos, child) {
                    var childPadding = child.padding;

                    // merge current and previous paddings
                    if (isRow) {
                        childPos.x -= Math.min(childPos.prevPaddingRight, childPadding[3]);
                    } else if (isColumn) {
                        childPos.y -= Math.min(childPos.prevPaddingBottom, childPadding[0]);
                    }

                    if (child.type) {
                        // recursively map children
                        child.map(childPos);
                    } else {
                        child.positionX = childPos.x;
                        child.positionY = childPos.y;
                    }

                    if (isRow) {
                        childPos.x += child.totalWidth;
                    } else if (isColumn) {
                        childPos.y += child.totalHeight;
                    }

                    childPos.prevPaddingRight = childPadding[1];
                    childPos.prevPaddingBottom = childPadding[2];

                    return childPos;
                }, {
                    x : startPosition.x,
                    y : startPosition.y,
                    prevPaddingRight : 0,
                    prevPaddingBottom : 0
                });

            return block;
        };

        Block.prototype._checkEfficiency = function(child) {
            var block = this,
                width,
                height;

            block._addDeclaration(child);

            width = block.fitter.width;
            height = block.fitter.height;

            block.remove(block.children.length - 1);

            return (height * height + width * width);
        };

        Block.prototype._scan_fit = function(items) {
            var canvas = this,
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

            this.add(items);

            do {
                canvas._update();
                blocks = canvas.children;
                blocksCount = blocks.length;
                isChanged = false;

                for (acceptorInd = 0; acceptorInd < blocksCount; acceptorInd += 1) {
                    acceptor = blocks[acceptorInd];

                    for (donorInd = acceptorInd + 1; donorInd < blocksCount; donorInd += 1) {
                        donor = blocks[donorInd];
                        donorImages = donor.items;
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
                                fittestBlock._addDeclaration(image);

                                changedImages.push(image.id);
                                isChanged = true;
                            }

                            if ( ! imageParent.items.length) {
                                imageParent.parent.remove(imageParent);
                            }
                        }
                    }
                }

            } while (isChanged);
        };

        Block.prototype._addDeclaration = function(child) {
            var block = this,
                newBlock;

            if (block.isParent) {
                newBlock = block._newBlock();
                newBlock._addDeclaration(child);
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

            block.children.push(newBlock);
            block._update();
        };

        Block.prototype._newBlock = function() {
            return new Block({ type : this.childType }, this);
        };

        Block.prototype._getFittestBlock = function(item) {
            var block = this,
                childEfficiency,
                myEfficiency,
                fittestBlock,
                found;

            if ( ! block._willFit(item)) {
                return;
            }

            if (block.isParent) {
                found = block._willChildrenFit(item);
                if (found && found.elem) {
                    fittestBlock = found.elem;
                    childEfficiency = found.efficiency;
                }
            }

            if (fittestBlock) {
                myEfficiency = block._checkEfficiency(item);
                if (childEfficiency > myEfficiency) {
                    fittestBlock = block;
                }
            } else {
                fittestBlock = block;
            }

            return fittestBlock;
        };

        Block.prototype._willChildrenFit = function(item) {
            var block = this;

            return block.children.reduce(function(bestFit, child) {
                var elem = child._getFittestBlock(item),
                    efficiency;

                if (elem) {
                    efficiency = elem._checkEfficiency(item);

                    if (bestFit.efficiency > efficiency) {
                        bestFit.efficiency = efficiency;
                        bestFit.elem = elem;
                    }
                }

                return bestFit;
            }, {
                efficiency : Infinity,
                elem : false
            });

        };

        Block.prototype._willFit = function(item) {
            var maxH = this.maxHeight,
                maxW = this.maxWidth,
                hDiff = maxH - (this.type === 'column' ? this.totalHeight : 0) - item.totalHeight,
                wDiff = maxW - (this.type === 'row' ? this.totalWidth : 0) - item.totalWidth,
                hDiffPerc = Math.abs(hDiff) * 100 / maxH,
                wDiffPerc = Math.abs(wDiff) * 100 / maxW,
                hDiffAllowed,
                wDiffAllowed;

            hDiffAllowed = ! maxH || hDiff >= 0 ||
                (hDiffPerc <= this.fitter.allowed_diff);

            wDiffAllowed = ! maxW || wDiff >= 0 ||
                (wDiffPerc <= this.fitter.allowed_diff);

            return hDiffAllowed && wDiffAllowed;
        };

        Block.prototype._update = function(isCapture) {
            if (isCapture && this.isParent) {
                this.children.forEach(function(child) {
                    child._update(true);
                });
            }

            this._updateCache();

            isCapture || this.parent && this.parent._update();

            return this;
        };

        Block.prototype._updateCache = function() {
            this.items = this.items = this._getItems();
            this.width = this._getWidth();
            this.height = this._getHeight();
            this.padding = this._getPadding();
        };

        Block.prototype._getItems = function() {
            return ! this.isParent ?
                this.children :
                this.children
                    .reduce(function(children, child) {
                        return children.concat(child.items);
                    }, []);
        };

        Block.prototype._getPadding = function() {
            var block = this,
                type = block.type,
                isRow = type === 'row',
                children = this.children,
                len = children.length,
                padding2 = [ 0, 0, 0, 0 ],
                data;

            if ( ! len) {
                return padding2;
            }

            if (isRow) {
                data = children.reduce(function(max, child) {
                    var childPadding = child.padding;

                    return {
                        minTopPadding : Math.min(childPadding[0], max.minTopPadding),
                        maxHeight : Math.max(child.totalHeight - childPadding[2], max.maxHeight)
                    };
                }, {
                    minTopPadding : Infinity,
                    maxHeight : 0
                });

                padding2[0] = data.minTopPadding;
                padding2[1] = children[len - 1].padding[1];
                padding2[2] = block.totalHeight - data.maxHeight;
                padding2[3] = children[0].padding[3];

            } else {
                data = children.reduce(function(max, child) {
                    return {
                        minLeftPadding : Math.min(child.padding[3], max.minLeftPadding),
                        maxWidth : Math.max(child.totalWidth - child.padding[1], max.maxWidth)
                    };
                }, {
                    minLeftPadding : Infinity,
                    maxWidth : 0
                });

                padding2[0] = children[0].padding[0];
                padding2[1] = block.totalWidth - data.maxWidth;
                padding2[2] = children[len - 1].padding[2];
                padding2[3] = data.minLeftPadding;
            }

            return padding2;
        };

        Block.prototype._getWidth = function() {
            return this.type === 'column' ?
                this.children
                    .reduce(function(lastMaxWidth, child) {
                        return Math.max(child.totalWidth, lastMaxWidth);
                    }, 0) :
                this.children
                    .reduce(function(sum, child) {
                        var childPadding = child.padding;

                        return {
                            total : sum.total + child.totalWidth - Math.min(sum.prevPaddingRight, childPadding[3]),
                            prevPaddingRight : childPadding[1]
                        };
                    }, { total : 0, prevPaddingRight : 0 })
                    .total;
        };

        Block.prototype._getMaxWidth = function() {
            var maxW = this.parent ?
                    (this.type === 'row' ? this.parent.maxWidth : this.width) :
                    this.fitter.maxWidth;

            return maxW || 0;
        };

        Block.prototype._getTotalWidth = function() {
            return this.width || 0;
        };

        Block.prototype._getHeight = function() {
            return this.type === 'row' ?
                this.children
                    .reduce(function(lastMaxHeight, child) {
                        var childHeight = child.totalHeight;

                        return Math.max(childHeight, lastMaxHeight);
                    }, 0) :
                this.children
                    .reduce(function(sum, child) {
                        var childPadding = child.padding;

                        return {
                            total : sum.total + child.totalHeight - Math.min(sum.prevPaddingBottom, childPadding[0]),
                            prevPaddingBottom : childPadding[2]
                        };
                    }, { total : 0, prevPaddingBottom : 0 })
                    .total;
        };

        Block.prototype._getMaxHeight = function() {
            var maxH = this.parent ?
                    this.type === 'column' ? this.parent.maxHeight : this.height :
                    this.fitter.maxHeight;

            return maxH || 0;
        };

        Block.prototype._getTotalHeight = function() {
            return this.height;
        };

        return Fitter;
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

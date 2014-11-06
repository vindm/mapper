(function() {

    var Mapper = (function() {

        /**
         * @constructor
         * @param {Object} config
         */
        var Mapper = function(config) {
            var canvas,
                type,
                deep;

            this.layout = config.layout || 'smart';
            this.padding = config.padding || [ 0, 0, 0, 0 ];

            if ( ! config.canvas) {
                type = 'column';
                deep = 1;

                if (this.layout === 'horizontal') {
                    type = 'row';
                } else if (this.layout === 'smart') {
                    deep = 9;
                }

                canvas = Container.create({ type : type, deep : deep }, null, this);
            } else {
                canvas = Container.restore(config.canvas, null, this);
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

        /**
         * @static
         * @private
         * @param {Object[]} items
         * @returns {Object} Items dimensions
         */
        Mapper._getItemsDimensions = function(items) {
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

        /**
         * @static
         * @private
         * @param {Object[]} items
         * @returns {Object[]} Sorted items
         */
        Mapper._sort_for_horizontal = function(items) {
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

        /**
         * @static
         * @private
         * @param {Object[]} items
         * @returns {Object[]} Sorted items
         */
        Mapper._sort_for_vertical = function(items) {
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

        /**
         * @static
         * @private
         * @param {Object[]} items
         * @returns {Object[]} Sorted items
         */
        Mapper._sort_for_smart = function(items) {
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

        Object.defineProperties(
            Mapper.prototype, {
                items : {
                    get : function() {
                        return this.canvas && this.canvas.items;
                    }
                }
            }
        );

        /**
         * Add items to storage
         * @param {Object[]} items
         * @returns {Mapper}
         */
        Mapper.prototype.add = function(items) {

            items = [].concat(this.items || [], items);

            var canvas = this.canvas,
                dims = Mapper._getItemsDimensions(items),
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
            this.allowed_diff = 25;

            canvas.drop();

            this._add(items);

            return this;
        };

        /**
         * Safe add items to storage
         * @param {Object[]} items
         * @returns {Mapper}
         */
        Mapper.prototype.safeAdd = function(items) {
            var canvas = this.canvas,
                dims = Mapper._getItemsDimensions(items),
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

        /**
         * Remove items from storage
         * @param {Object[]} items
         * @returns {Mapper}
         */
        Mapper.prototype.remove = function(items) {
            Array.isArray(items) || (items = [ items ]);

            this.items && this.items.forEach(function(image) {
                if (items.indexOf(image) !== -1) {
                    image.parent.remove(image);
                }
            });
        };

        /**
         * Add items to storage
         * @returns {Object[]} Mapped items with defined position
         */
        Mapper.prototype.map = function() {
            this.canvas.map();

            return this.items;
        };

        /**
         * @private
         * @param {Object[]} items
         * @returns {Mapper}
         */
        Mapper.prototype._add = function(items) {
            Array.isArray(items) || (items = [ items ]);

            Mapper['_sort_for_' + this.layout](items);

            this.canvas._update(true);

            items.forEach(function(item) {
                this._prepareItem(item);
                this._forceAdd(item);
            }, this);

            return this;
        };

        /**
         * @private
         * @param {Object} item
         * @returns {Mapper}
         */
        Mapper.prototype._forceAdd = function(item) {
            if ( ! this.canvas.add(item)) {
                this.maxHeight += item.totalHeight;
                this.maxWidth += item.totalWidth;

                this._forceAdd(item);
            }

            return this;
        };

        /**
         * @private
         * @param {Object} item
         * @returns {Object} Prepared item
         */
        Mapper.prototype._prepareItem = function(item) {
            item.padding || (item.padding = this.padding);
            item.totalWidth = item.padding[3] + item.width + item.padding[1];
            item.totalHeight = item.padding[0] + item.height + item.padding[2];

            return item;
        };

        /**
         * @constructor
         * @param {Object} config
         * @param {Container} parent
         * @param {Mapper} fitter
         */
        var Container = function(config, parent, fitter) {
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

        /**
         * @static
         * @param {Object} config
         * @param {Container} parent
         * @param {Mapper} [fitter=parent]
         * @returns {Container} New container
         */
        Container.create = function(config, parent, fitter) {
            var container;

            if (config.type) {
                container = new Container(config, parent, fitter);
            } else {
                container = config;
                Object.defineProperty(container, 'parent', { value : parent });
            }

            return container;
        };

        /**
         * @static
         * @param {Object} config
         * @param {Container} parent
         * @param {Mapper} fitter
         * @returns {Container} Restored container
         */
        Container.restore = function(config, parent, fitter) {
            var container;

            if (config.type) {
                container = new Container(config, parent, fitter);
                container.children = container.children.map(function(child) {
                    return Container.restore(child, container, fitter);
                });
            } else {
                container = config;
                Object.defineProperty(container, 'parent', { value : parent });
            }

            return container;
        };

        Object.defineProperties(
            Container.prototype, {
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

        /**
         * Add item to container
         * @param {Object} item
         * @returns {Boolean} State
         */
        Container.prototype.add = function(item) {
            var container = this,
                elem = container._getFittestBlock(item),
                isAdded = false;

            if (elem) {
                elem._addChild(item);
                isAdded = true;
            }

            return isAdded;
        };

        /**
         * Remove item from container
         * @param {Object} item
         */
        Container.prototype.remove = function(item) {
            var container = this,
                index,
                removed;

            index = typeof item === 'number' ?
                item :
                container.children.indexOf(item);

            if (index !== -1) {
                removed = container.children.splice(index, 1);
                removed.parent = null;

                container._update();
            }
        };

        /**
         * Remove all items from container
         */
        Container.prototype.drop = function() {
            this.children = [];
            this._update();
        };

        /**
         * Map items in container
         * @param {Object} startPosition
         * @returns {Container}
         */
        Container.prototype.map = function(startPosition) {
            var isColumn = this.type === 'column',
                isRow = ! isColumn && this.type === 'row';

            startPosition || (startPosition = { x : 0, y : 0 });

            this.children
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
                        child.positionX = childPos.x + childPadding[3];
                        child.positionY = childPos.y + childPadding[0];
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

            return this;
        };

        /**
         * @private
         * @param {Object} child
         * @returns {Number} Efficiency value
         */
        Container.prototype._getEfficiency = function(child) {
            var block = this,
                width,
                height;

            block._addChild(child);

            width = block.fitter.width;
            height = block.fitter.height;

            block.remove(block.children.length - 1);

            return (height * height + width * width);
        };

        /**
         * Add child
         * @param {Container|Object} child
         * @private
         */
        Container.prototype._addChild = function(child) {
            var block = this,
                newBlock;

            if (block.isParent) {
                newBlock = block._newContainer();
                newBlock._addChild(child);
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

        /**
         * @private
         * @returns {Container}
         */
        Container.prototype._newContainer = function() {
            return Container.create({ type : this.childType }, this);
        };

        /**
         * @private
         * @param {Object} item
         * @returns {?Container} The fittest container
         */
        Container.prototype._getFittestBlock = function(item) {
            var childEfficiency,
                myEfficiency,
                fittestBlock,
                found;

            if ( ! this._willFit(item)) {
                return null;
            }

            if (this.isParent) {
                found = this._willChildrenFit(item);
                if (found && found.elem) {
                    fittestBlock = found.elem;
                    childEfficiency = found.efficiency;
                }
            }

            if (fittestBlock) {
                myEfficiency = this._getEfficiency(item);
                if (childEfficiency > myEfficiency) {
                    fittestBlock = this;
                }
            } else {
                fittestBlock = this;
            }

            return fittestBlock;
        };

        /**
         * @private
         * @param {Object} item
         * @returns {Object} The fittest child with efficiency value
         */
        Container.prototype._willChildrenFit = function(item) {
            return this.children.reduce(function(bestFit, child) {
                var elem = child._getFittestBlock(item),
                    efficiency;

                if (elem) {
                    efficiency = elem._getEfficiency(item);

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

        /**
         * @private
         * @param {Object} item
         * @returns {Boolean} Will container fit item
         */
        Container.prototype._willFit = function(item) {
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

        /**
         * Update container state
         * @private
         * @param {Boolean} isCapture
         * @returns {Container}
         */
        Container.prototype._update = function(isCapture) {
            if (isCapture && this.isParent) {
                this.children.forEach(function(child) {
                    child._update(true);
                });
            }

            this._updateCache();

            isCapture || this.parent && this.parent._update();

            return this;
        };

        /**
         * Update container cache
         * @private
         */
        Container.prototype._updateCache = function() {
            this.items = this.items = this._getItems();
            this.width = this._getWidth();
            this.height = this._getHeight();
            this.padding = this._getPadding();
        };

        /**
         * @private
         * @returns {Container[]|Object[]} Children containers or mapping items
         */
        Container.prototype._getItems = function() {
            return ! this.isParent ?
                this.children :
                this.children
                    .reduce(function(children, child) {
                        return children.concat(child.items);
                    }, []);
        };

        /**
         * @private
         * @returns {Number[]} Container paddings
         */
        Container.prototype._getPadding = function() {
            var type = this.type,
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
                padding2[2] = this.totalHeight - data.maxHeight;
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
                padding2[1] = this.totalWidth - data.maxWidth;
                padding2[2] = children[len - 1].padding[2];
                padding2[3] = data.minLeftPadding;
            }

            return padding2;
        };

        /**
         * @private
         * @returns {Number} Container width
         */
        Container.prototype._getWidth = function() {
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

        /**
         * @private
         * @returns {Number} Container max-width
         */
        Container.prototype._getMaxWidth = function() {
            var maxW = this.parent ?
                (this.type === 'row' ? this.parent.maxWidth : this.width) :
                this.fitter.maxWidth;

            return maxW || 0;
        };

        /**
         * @private
         * @returns {Number} Container width + paddings
         */
        Container.prototype._getTotalWidth = function() {
            return this.width || 0;
        };

        /**
         * @private
         * @returns {Number} Container height
         */
        Container.prototype._getHeight = function() {
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

        /**
         * @private
         * @returns {Number} Container max-height
         */
        Container.prototype._getMaxHeight = function() {
            var maxH = this.parent ?
                    this.type === 'column' ? this.parent.maxHeight : this.height :
                this.fitter.maxHeight;

            return maxH || 0;
        };

        /**
         * @private
         * @returns {Number} Container height + paddings
         */
        Container.prototype._getTotalHeight = function() {
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

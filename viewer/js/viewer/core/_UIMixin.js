define([
	'dojo/_base/declare',
	'dojo/_base/lang',
	'dojo/_base/array',
	'dojo/on',
	'dojo/aspect',
	'dojo/dom',
	'dojo/dom-style',
	'dojo/dom-geometry',
	'dojo/dom-class',
	'dojo/has',

	'put-selector',

	'dijit/layout/BorderContainer',
	'dijit/layout/ContentPane',

	'esri/dijit/PopupMobile',

	'dojo/text!../templates/mapOverlay.html'
], function (
	declare,
	lang,
	array,
	on,
	aspect,
	dom,
	domStyle,
	domGeom,
	domClass,
	has,

	put,

	BorderContainer,
	ContentPane,

	PopupMobile,

	mapOverlay
) {
	return declare(null, {

		panes: {
			left: {
				id: 'sidebarLeft',
				placeAt: 'outer',
				collapsible: true,
				region: 'left'
			},
			center: {
				id: 'mapCenter',
				placeAt: 'outer',
				region: 'center',
				content: mapOverlay
			}
		},

		collapseButtons: {},

		initUI: function () {
			this.addTitles();
			this.detectTouchDevices();
			this.initPanes();
		},

		// set titles (if any)
		addTitles: function () {
			if (!this.config.titles) {
				return;
			}
			var titles = this.config.titles;
			if (titles.header) {
				var headerTitleNode = dom.byId('headerTitleSpan');
				if (headerTitleNode) {
					headerTitleNode.innerHTML = titles.header;
				}
			}
			if (titles.subHeader) {
				var subHeaderTitle = dom.byId('subHeaderTitleSpan');
				if (subHeaderTitle) {
					subHeaderTitle.innerHTML = titles.subHeader;
				}
			}
			if (titles.pageTitle) {
				document.title = titles.pageTitle;
			}
		},

		// setup all the sidebar panes
		initPanes: function () {
			var key, panes = this.config.panes || {};

			for (key in this.panes) {
				if (this.panes.hasOwnProperty(key)) {
					panes[key] = lang.mixin(this.panes[key], panes[key]);
				}
			}

			this.createPanes(panes);
		},

		// simple feature detection. kinda like dojox/mobile without the overhead
		detectTouchDevices: function () {
			if (has('touch') && (has('ios') || has('android') || has('bb'))) {
				has.add('mobile', true);
				if (screen.availWidth < 500 || screen.availHeight < 500) {
					has.add('phone', true);
				} else {
					has.add('tablet', true);
				}

				// use the mobile popup for phones
				if (has('phone') && !this.config.mapOptions.infoWindow) {
					this.config.mapOptions.infoWindow = new PopupMobile(null, put('div'));
				}
			}

		},

		createPanes: function (panes) {
			this.panes.outer = new BorderContainer({
				id: 'borderContainerOuter',
				design: 'sidebar',
				gutters: false
			}).placeAt(document.body);

			var key, options, placeAt, type;
			for (key in panes) {
				if (panes.hasOwnProperty(key)) {
					options = lang.clone(panes[key]);
					placeAt = this.panes[options.placeAt] || this.panes.outer;
					options.id = options.id || key;
					type = options.type;
					delete options.placeAt;
					delete options.type;
					delete options.collapsible;
					if (placeAt) {
						if (type === 'border') {
							this.panes[key] = new BorderContainer(options).placeAt(placeAt);
						} else if (options.region) {
							this.panes[key] = new ContentPane(options).placeAt(placeAt);
						}
					}
				}
			}

			this.panes.outer.startup();

			// now add the Collapse Buttons for the panes
			this.createPaneCollapseButtons(panes);
		},

		createPaneCollapseButtons: function (panes) {
			// where to place the buttons
			// either the center map pane or the outer pane?
			this.collapseButtonsPane = this.config.collapseButtonsPane || 'outer';

			for (var key in panes) {
				if (panes.hasOwnProperty(key)) {
					if (panes[key].collapsible) {
						this.collapseButtons[key] = put(this.panes[this.collapseButtonsPane].domNode, 'div.sidebarCollapseButton.sidebar' + key + 'CollapseButton.sidebarCollapseButton' + ((key === 'bottom' || key === 'top') ? 'Vert' : 'Horz') + ' div.dijitIcon.button.close').parentNode;
						on(this.collapseButtons[key], 'click', lang.hitch(this, 'togglePane', key));
						this.positionSideBarToggle(key);
						if (this.collapseButtonsPane === 'outer') {
							var splitter = this.panes[key]._splitterWidget;
							if (splitter) {
								aspect.after(splitter, '_startDrag', lang.hitch(this, 'splitterStartDrag', key));
								aspect.after(splitter, '_stopDrag', lang.hitch(this, 'splitterStopDrag', key));
							}
						}
						if (panes[key].open !== undefined) {
							this.togglePane(key, panes[key].open);
						}
					}
					if (key !== 'center' && this.panes[key]._splitterWidget) {
						domClass.add(this.map.root.parentNode, 'pane' + key);
						if (key === 'right' && this.panes.top) {
							domClass.add(this.panes.top.domNode, 'pane' + key);
						}
						if (key === 'right' && this.panes.bottom) {
							domClass.add(this.panes.bottom.domNode, 'pane' + key);
						}
						if (key === 'left' && this.panes.top) {
							domClass.add(this.panes.top.domNode, 'pane' + key);
						}
						if (key === 'left' && this.panes.bottom) {
							domClass.add(this.panes.bottom.domNode, 'pane' + key);
						}
					}
				}
			}

			// respond to media query changes
			// matchMedia works in most browsers (http://caniuse.com/#feat=matchmedia)
			if (window.matchMedia) {
				window.matchMedia('(max-width: 991px)').addListener(lang.hitch(this, 'repositionSideBarButtons'));
				window.matchMedia('(max-width: 767px)').addListener(lang.hitch(this, 'repositionSideBarButtons'));
			}
		},

		positionSideBarToggle: function (id) {
			var pane = this.panes[id];
			var btn = this.collapseButtons[id];
			if (!pane || !btn) {
				return;
			}
			var disp = domStyle.get(pane.domNode, 'display');
			var rCls = (disp === 'none') ? 'close' : 'open';
			var aCls = (disp === 'none') ? 'open' : 'close';
			domClass.remove(btn.children[0], rCls);
			domClass.add(btn.children[0], aCls);

			// extra management required when the buttons
			// are not in the center map pane
			if (this.collapseButtonsPane === 'outer') {
				var pos = (pane._splitterWidget) ? 0 : -1;
				var orie = (id === 'bottom' || id === 'top') ? 'h' : 'w';
				if (disp === 'block') { // pane is open
					pos += domGeom.getMarginBox(pane.domNode)[orie];
				}
				if (pane._splitterWidget) { // account for a splitter
					pos += domGeom.getMarginBox(pane._splitterWidget.domNode)[orie];
				}
				domStyle.set(btn, id, pos.toString() + 'px');
				domStyle.set(btn, 'display', 'block');
			}
		},

		togglePane: function (id, show) {
			if (!this.panes[id]) {
				return;
			}
			var domNode = this.panes[id].domNode;
			if (domNode) {
				var disp = (show && typeof (show) === 'string') ? show : (domStyle.get(domNode, 'display') === 'none') ? 'block' : 'none';
				domStyle.set(domNode, 'display', disp);
				if (this.panes[id]._splitterWidget) { // show/hide the splitter, if found
					domStyle.set(this.panes[id]._splitterWidget.domNode, 'display', disp);
				}
				this.positionSideBarToggle(id);
				if (this.panes.outer) {
					this.panes.outer.resize();
				}
			}
		},

		repositionSideBarButtons: function () {
			var btns = ['left', 'right', 'top', 'bottom'];
			array.forEach(btns, lang.hitch(this, function (id) {
				this.positionSideBarToggle(id);
			}));
		},

		// extra management of splitters required when the buttons
		// are not in the center map pane
		splitterStartDrag: function (id) {
			var btn = this.collapseButtons[id];
			domStyle.set(btn, 'display', 'none');
		},

		splitterStopDrag: function (id) {
			this.positionSideBarToggle(id);
		}
	});
});
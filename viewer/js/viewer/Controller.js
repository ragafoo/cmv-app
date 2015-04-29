define([
	'dojo/_base/declare',

	'./core/_ConfigMixin',
	'./core/_MapMixin',
	'./core/_UIMixin',
	'./core/_WidgetsMixin',

	'dojo/_base/lang',
	'dojo/topic',

	'esri/IdentityManager'
], function (
	declare,

	_ConfigMixin,
	_MapMixin,
	_UIMixin,
	_WidgetsMixin,

	lang,
	topic
) {

	return declare([_ConfigMixin, _MapMixin, _UIMixin, _WidgetsMixin], {
		legendLayerInfos: [],
		editorLayerInfos: [],
		identifyLayerInfos: [],
		layerControlLayerInfos: [],

		startup: function () {
			this.inherited(arguments);

			// in _ConfigMixin
			this.initConfigAsync().then(
				lang.hitch(this, 'initConfigSuccess'),
				lang.hitch(this, 'initConfigError')
			);
		},

		initConfigSuccess: function(config) {
			this.config = config;

			if (config.isDebug) {
				window.app = this; //dev only
			}

			// setup the map click mode
			this.mapClickMode = {
				current: config.defaultMapClickMode,
				defaultMode: config.defaultMapClickMode
			};

			this.addTopics();

			// in _UIMixin
			this.initUI();

			// in _MapMixin
			this.initMapAsync().then(
				lang.hitch(this, 'initMapComplete'),
				lang.hitch(this, 'initMapError')
			);
		},

		initConfigError: function(err) {
			this.handleError({
				source: 'Controller',
				error: err
			});
		},

		initMapComplete: function(warnings) {
			if(warnings && warnings.length > 0) {
				this.handleError({
					source: 'Controller',
					error: warnings.join(', ')
				});
			}

			this.map.on('resize', function (evt) {
				var pnt = evt.target.extent.getCenter();
				setTimeout(function () {
					evt.target.centerAt(pnt);
				}, 100);
			});

			this.panes.outer.resize();

			// in _WidgetsMixin
			this.initWidgets();
		},

		initMapError: function(err) {
			this.handleError({
				source: 'Controller',
				error: err
			});
		},

		// add topics for subscribing and publishing
		addTopics: function () {

			// toggle a sidebar pane
			topic.subscribe('viewer/togglePane', lang.hitch(this, function (args) {
				this.togglePane(args.pane, args.show);
			}));

			// load a widget
			topic.subscribe('viewer/loadWidget', lang.hitch(this, function (args) {
				this.widgetLoader(args.options, args.position);
			}));

			// setup error handler. centralize the debugging
			if (this.config.isDebug) {
				topic.subscribe('viewer/handleError', lang.hitch(this, 'handleError'));
			}

			// set the current mapClickMode
			topic.subscribe('mapClickMode/setCurrent', lang.hitch(this, function (mode) {
				this.mapClickMode.current = mode;
				topic.publish('mapClickMode/currentSet', mode);
			}));

			// set the current mapClickMode to the default mode
			topic.subscribe('mapClickMode/setDefault', lang.hitch(this, function () {
				topic.publish('mapClickMode/setCurrent', this.mapClickMode.defaultMode);
			}));

		},

		//centralized error handler
		handleError: function (options) {
			if (this.config && this.config.isDebug) {
				if (typeof (console) === 'object') {
					for (var option in options) {
						if (options.hasOwnProperty(option)) {
							console.log(option, options[option]);
						}
					}
				}
			} else {
				// add growler here?
				return;
			}
		}
	});
});
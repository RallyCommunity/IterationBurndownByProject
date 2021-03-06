Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    settingsScope: 'workspace',

    mixins: [
        'IterationBurnDownMinimalChart'
    ],


    items: [
        {
            xtype: 'container',
            itemId: 'header',
            cls: 'header'
        }
    ],


    launch: function () {

        this.add({
            xtype: 'rallyprojectpicker',
            itemId: 'projectpicker',
            listeners: {
                change: function() {
                    this._onScopeObjectLoaded();
                },
                scope: this
            }
        });

        this.down('#projectpicker').setValueForProjectRef(this.getContext().getProjectRef());


        this.callParent(arguments);
        //this._onScopeObjectLoaded(this.getContext().getTimeboxScope().record);
    },

    _onScopeObjectLoaded: function () {

        // var myStore = Ext.create('Rally.data.wsapi.Store', {
        //     model: 'Iteration',
        //     autoLoad: true,
        //     listeners: {
        //         load: function(store, data, success) {
        //             console.log('Static Store Success', success);
        //             console.log('Static Store Data: ', data);
        //         }
        //     }
        // });

        this._createIterationBox();
    },

    _createIterationBox: function(iterations) {
        this.remove('iterationbox', false);
        this.add({
            xtype: 'rallycombobox',
            itemId: 'iterationbox',
            storeConfig: {
                model: 'Iteration',
                autoLoad: true,
                context: {
                    project: this.down('#projectpicker').getSelectedRecord().get('_ref')
                }
            },
            defaultSelectionPosition: 'last',
            listeners: {
                ready: function() { 
                    this._getIterationData(this.down('#iterationbox').getRecord()) 
                },
                change: function() { this._getIterationData(this.down('#iterationbox').getRecord()) },
                scope: this
            }
       });

    },

    _getElementValue: function(element) {
        if(element.textContent){
            return element.textContent;
        }
        return element.text;
    },

    _configureYAxisIntervals: function() {
        var ticks = 5; // not much chart space, limit to 5
        var intervalY0 = (this.chartComponentConfig.chartConfig.yAxis[0].max  - 0) / (ticks - 1);
        var intervalY1 = (this.chartComponentConfig.chartConfig.yAxis[1].max  - 0) / (ticks - 1);
        var ticksY0 = [],
            ticksY1 = [];
        for (i = 0; i < ticks; i++) {
            ticksY0.push(i * intervalY0);
            ticksY1.push(i * intervalY1);
        }

        this.chartComponentConfig.chartConfig.yAxis[0].tickPositions = ticksY0;
        this.chartComponentConfig.chartConfig.yAxis[1].tickPositions = ticksY1;
    },

    _getStringValues: function(elements) {
        var i;
        var strings = [];
        for(i=0;i<elements.length;i++) {
            strings.push(this._getElementValue(elements[i]));
        }
        return strings;
    },

    _getNumberValues: function(elements) {
        var i;
        var numbers = [];
        for(i=0;i<elements.length;i++) {
            numbers.push(this._getElementValue(elements[i]).split(' ')[0] * 1);
        }
        return numbers;
    },

    _createChartDatafromXML: function(xml) {
        var parseXml;

        if (typeof window.DOMParser !== "undefined") {
            parseXml = function(xmlStr) {
                return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");
            };
        } else if (typeof window.ActiveXObject !== "undefined" &&
            new window.ActiveXObject("Microsoft.XMLDOM")) {
                parseXml = function(xmlStr) {
                    var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
                    xmlDoc.async = "false";
                    xmlDoc.loadXML(xmlStr);
                    return xmlDoc;
                };
        } else {
            throw new Error("No XML parser found");
        }
        var xmlDoc = parseXml(xml);

        var xmlChartData = xmlDoc.getElementsByTagName("chart_data")[0];
        var xmlChartValueText = xmlDoc.getElementsByTagName("chart_value_text")[0];
        var draw = xmlDoc.getElementsByTagName("draw")[0];
        var axis_value = xmlDoc.getElementsByTagName("axis_value")[1];

        var rows = xmlChartData.getElementsByTagName("row");

        // this makes no sense...The thing labeled Accepted in the <chart_data> element, isn't.
        // The thing that is Accepted, is buried in the <chart_value_text> element

        this.chartComponentConfig.chartData.categories = this._getStringValues(rows[0].getElementsByTagName("string")); // categories
        this.chartComponentConfig.chartData.series[0].data = this._getNumberValues(rows[1].getElementsByTagName("number")); //todo;
        this.chartComponentConfig.chartData.series[1].data = this._getNumberValues(rows[3].getElementsByTagName("number")); //ideal;
        this.chartComponentConfig.chartData.series[2].data = this._getNumberValues(xmlChartValueText.getElementsByTagName("row")[2].getElementsByTagName("number")); //accepted;
        this.chartComponentConfig.chartConfig.yAxis[0].max = axis_value.getAttribute("max") * 1;

        var texts = draw.getElementsByTagName("text");
        // find the last <text element with orientation="vertical_down" attribute, that's the max y-axis 2 setting
        for(i=0;i<texts.length;i++) {
            if(texts[i].getAttribute("orientation") === "vertical_down") {
                this.chartComponentConfig.chartConfig.yAxis[1].max = (this._getElementValue(texts[i]) * 1);
            }
        }
        this._configureYAxisIntervals();
        this.chartComponentConfig.chartConfig.xAxis.tickInterval = this.chartComponentConfig.chartData.series[0].data.length / 5;

        this._addChart();
    },

    _getIterationData: function(iteration) {
        this.setLoading();
        var url = "/slm/charts/itsc.sp?sid=&iterationOid=" + iteration.get('ObjectID') + "&cpoid=" + this.down('#projectpicker').getSelectedRecord().get('ObjectID');
        console.log(url);
        Ext.Ajax.request({
            url: url,
            method: 'GET',
            withCredentials: true,
            success: function(response, request){
                this._createChartDatafromXML(response.responseText);
            },
            scope: this
        });
    },

    _getHeight: function() {
        return (this.el) ? this.getHeight() : undefined;
    },
    _getWidth: function() {
        return (this.el) ? this.getWidth() : undefined;
    },

    _addChart: function () {
        this.remove('iterationburndownminimalchart', false);
        this.chartComponentConfig.chartConfig.chart.height = (this.height)?this.height:this._getHeight();
        this.chartComponentConfig.chartConfig.chart.width = (this.width)?this.width:this._getWidth();
        var chartComponentConfig = Ext.Object.merge({}, this.chartComponentConfig);
        this.add(chartComponentConfig);
        this.setLoading(false);

        // HACK: need to remove load mask on high-charts due to lumenize lib loading issue
        var chart = this.down("#iterationburndownminimalchart");
        var p = Ext.get(chart.id);
        elems = p.query("div.x-mask");
        _.each(elems, function(e) { e.remove(); });
        var elems = p.query("div.x-mask-msg");
        _.each(elems, function(e) { e.remove(); });




    }

});

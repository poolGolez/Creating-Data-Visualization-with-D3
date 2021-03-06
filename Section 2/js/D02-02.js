function show() {
    'use strict';

    var margin = {top: 20, bottom: 20, right: 50, left: 20},
        width = 700 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    var chart = d3.select(".chart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + ","
            + margin.top + ")");

    var yearMax = 2014;
    var adjustedData;
    var unadjustedData;

    d3.queue()
        .defer(d3.csv, "./data/households.csv")
        .defer(d3.csv, "./data/householdsU.csv")
        .await(function (error, adjusted, unadjusted) {
            adjustedData = adjusted;
            unadjustedData = unadjusted;
            update();
        });

    function update(year) {
        year = year || yearMax;
        var yearIndex = (adjustedData.length - 1) - (yearMax - year);
        var adjustedIndexedData = adjustedData.map(function(d) {return mapToindexed(d, adjustedData[yearIndex])});
        var unadjustedCleaned = unadjustedData.map(mapToIncome);
        var maxAbove = Math.abs(100 - d3.max(adjustedIndexedData, function(d) {return d.indexed }));
        var maxBelow = Math.abs(100 - d3.min(adjustedIndexedData, function(d) {return d.indexed }));
        var xRangeAdjusted = Math.ceil(Math.max(maxAbove, maxBelow));
        var xScale = d3.scaleLinear()
            .range([0, width])
            .domain([1984,2014]);
        var yIndexedScale = d3.scaleLinear()
            .range([height, 0])
            .domain([100-xRangeAdjusted, 100+xRangeAdjusted]);
        var incomeMin = d3.min(unadjustedCleaned, function (d) {return d.value});
        var incomeMax = d3.max(unadjustedCleaned, function (d) {return d.value});
        var yIncomeScale =  d3.scaleLinear()
            .range([height, 0])
            .domain([
                Math.floor(incomeMin/2000) * 2000,
                Math.ceil(incomeMax/2000) * 2000
            ]);

        addGradients(yIndexedScale);
        addArea(xScale, yIndexedScale, adjustedIndexedData);
        addIndexedLine(xScale, yIndexedScale, adjustedIndexedData);
        addIncomeLine(xScale, yIncomeScale, unadjustedCleaned)
        addAxis(yIncomeScale, yIndexedScale, xScale, xRangeAdjusted)
        addMouseTracker(xScale, yIndexedScale, yIncomeScale, adjustedIndexedData, unadjustedCleaned);
    }

    function addAxis(yIncomeScale, yIndexedScale, xScale, xRangeAdjusted) {
        var rightAxis = d3.axisRight().scale(yIncomeScale).ticks(20);
        var rightAxisSVG = chart.append("g")
            .attr('transform', 'translate( ' + (width + 4) +  ')')
            .call(rightAxis);

        var steps = d3.range(100-xRangeAdjusted, 100+xRangeAdjusted + 1, 2);
        var leftAxis = d3.axisLeft().scale(yIndexedScale).tickValues(steps);
        var leftAxisSVG = chart.append("g")
            .attr('transform', 'translate( 0 ' + yIndexedScale(100 + xRangeAdjusted) +  ')')
            .call(leftAxis);

        leftAxisSVG.selectAll('text')
            .text(function(d) {
                return d === 100 ? "no change" : d3.format("+")(d - 100);
            })
            .attr("stroke", "#aaa")
            .attr("dy", "-0.5em")
            .attr("dx", "1em")
            .style("font-weight", "100")
            .attr("text-anchor", "start");

        leftAxisSVG.selectAll('.domain').remove();
        leftAxisSVG.selectAll('.tick line')
            .attr("x1", width)
            .attr("stroke", "#ddd")
            .attr("opacity", "0.6");

        var bottomAxis = d3.axisBottom().scale(xScale).ticks(15,"f");
        var bottomAxisChart = chart.append("g")
            .attr('transform', 'translate( 0 ' + yIndexedScale(100) +  ')')
            .call(bottomAxis);

        bottomAxisChart.selectAll('text')
            .attr("transform", "translate(-16 14) rotate(-70)");
    }

    function addMouseTracker(xScale, yIndexedScale, yIncomeScale, adjustedIndexedData, unadjustedCleaned) {

        var focus = chart.append("g").attr("class", "focus").style("display", "none");
        focus.append("circle").attr("id", "indexCircle").attr("r", 4.5);
        focus.append("circle").attr("id", "incomeCircle").attr("r", 4.5);
        focus.append("text").attr("id", "indexText").attr("x", 9).attr("dy", ".35em");
        focus.append("text").attr("id", "incomeText").attr("x", 9).attr("dy", ".35em");

        var verticalLineP = d3.line()([[0,-10],[0,height+10]]);
        focus.append("path")
            .attr("d", verticalLineP)
            .attr("class", "verLine")
            .attr("stroke", "grey")
            .attr("stroke-dasharray", "6,6")
            .attr("stroke-width", "1");

        chart.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .on("mouseover", function() { focus.style("display", null); })
            .on("mouseout", function() { focus.style("display", "none"); })
            .on("mousemove", mousemove);

        function mousemove() {

            var x0 = xScale.invert(d3.mouse(this)[0])
            var xToShow = Math.round(x0);
            var d = adjustedIndexedData[xToShow-1984];
            var dIncome = unadjustedCleaned[xToShow-1984];

            var xPos = xScale(xToShow);
            var yIncomePos = yIncomeScale(dIncome.value);
            var yIndexPos = yIndexedScale(d.indexed);

            focus.select("#indexCircle").attr("transform", "translate(" + xPos + "," + yIndexPos + ")");
            focus.select("#incomeCircle").attr("transform", "translate(" + xPos + "," + yIncomePos + ")");
            focus.select(".verLine").attr("transform", "translate(" + xPos + "," + 0 + ")");

            var textOffset = (yIncomePos < yIndexPos) ? 5 : -5;

            focus.select("#indexText")
                .attr("transform", "translate(" + xPos + "," + (yIndexedScale(d.indexed) + textOffset) + ")")
                .text(Math.round((d.indexed-100)*100)/100);
            focus.select("#incomeText")
                .attr("transform", "translate(" + xPos + "," + (yIncomeScale(dIncome.value) - textOffset) + ")")
                .text("$ " + dIncome.value);

        }
    }

    function addIncomeLine(xScale, yIncomeScale, unadjustedCleaned) {
        var lineIncome = d3.line()
            .x(function(d) { return xScale(d.date); })
            .y(function(d) { return yIncomeScale(d.value); })
            .curve(d3.curveCatmullRom.alpha(0.5));

        chart.append("path")
            .attr("d", lineIncome(unadjustedCleaned))
            .style("fill", "none")
            .style("stroke", "steelblue")
            .style("stroke-width", "2");
    }

    function addIndexedLine(xScale, yIndexedScale, adjustedIndexedData) {
        var line = d3.line()
            .x(function(d) { return xScale(d.date); })
            .y(function(d) { return yIndexedScale(d.indexed); })
            .curve(d3.curveCatmullRom.alpha(0.5));

        chart.append("path")
            .attr("d", line(adjustedIndexedData))
            .style("fill", "none")
            .style("stroke", "url(#line-gradient)")
            .style("stroke-width", "2");

    }

    function addArea(xScale, yIndexedScale, adjustedIndexedData) {
        var area = d3.area()
            .x1(function(d) { return xScale(d.date); })
            .y1(function(d) { return yIndexedScale(d.indexed); })
            .y0(function(d) { return (yIndexedScale(100)) })
            .x0(function(d) { return xScale(d.date); })
            .curve(d3.curveCatmullRom.alpha(0.5));

        chart.append("path")
            .attr("d", area(adjustedIndexedData))
            .style("fill",  "url(#area-gradient)");
    }

    function addGradients(yIndexed) {

        var rangeMax = yIndexed.invert(0);
        var rangeMin = yIndexed.invert(height);

        chart.append("linearGradient")
            .attr("id", "area-gradient")
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", 0).attr("y1", yIndexed(rangeMax))
            .attr("x2", 0).attr("y2", yIndexed(rangeMin))
            .selectAll("stop")
            .data([
                {offset: "0%", color: "#E5F2D7"},
                {offset: "50%", color: "#eee"},
                {offset: "100%", color: "#EFDBE3"}
            ])
            .enter().append("stop")
            .attr("offset", function(d) { return d.offset; })
            .attr("stop-color", function(d) { return d.color; });

        chart.append("linearGradient")
            .attr("id", "line-gradient")
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", 0).attr("y1", yIndexed(rangeMax))
            .attr("x2", 0).attr("y2", yIndexed(rangeMin))
            .selectAll("stop")
            .data([
                {offset: "0", color: "#97D755"},
                {offset: "0.5", color: "#97D755"},
                {offset: "0.5", color: "#CD94AB"},
                {offset: "1", color: "#CD94AB"}
            ])
            .enter().append("stop")
            .attr("offset", function(d) { return d.offset; })
            .attr("stop-color", function(d) { return d.color; });
    }

    function mapToindexed(row, refRow) {
        var income = +row.MEHOINUSA672N;
        var reference = +refRow.MEHOINUSA672N;
        return {
            date: row.DATE.split('-')[0],
            indexed: (income/reference) * 100
        };
    }
    function mapToIncome(row) {
        var income = +row.MEHOINUSA646N;
        return {
            date: row.DATE.split('-')[0],
            value: income
        };
    }
}

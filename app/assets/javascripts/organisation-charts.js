// Shared d3.chart definitions for the organisation overview page (d3 v3 + d3.chart)
(function (d3) {
  var colours = {
    yellow: '#ffdd00',
    blue: '#5694ca',
    crimson: '#a01a4b',
    green: '#a8bd0c'
  }

  var formatNumber = function (value) {
    return value % 1 === 0 ? d3.format(',d')(value) : d3.format(',.1f')(value)
  }

  var formats = {
    millions: function (value) { return '£' + formatNumber(value) + 'm' },
    percent: function (value) { return formatNumber(value) + '%' },
    pounds: function (value) { return '£' + d3.format(',.0f')(value) }
  }

  // Shared sizing and number format for every chart
  d3.chart('GcaChart', {
    format: formats.millions,
    width: function (w) { if (!arguments.length) return this._w; this._w = w; return this },
    height: function (h) { if (!arguments.length) return this._h; this._h = h; return this }
  })

  d3.chart('GcaChart').extend('GcaBarChart', {
    initialize: function () {
      var chart = this
      this.margin = { top: 10, right: 20, bottom: 40, left: 60 }
      this.axisX = this.base.append('g').attr('class', 'gca-axis gca-axis--x')
      this.axisY = this.base.append('g').attr('class', 'gca-axis gca-axis--y')
      this.plot = this.base.append('g')

      this.layer('bars', this.plot.append('g'), {
        dataBind: function (data) { return this.selectAll('rect').data(data) },
        insert: function () { return this.append('rect') },
        events: {
          'merge': function () { chart.styleBars(this) }
        }
      })

      this.layer('values', this.plot.append('g'), {
        dataBind: function (data) { return this.selectAll('text.gca-bar-value').data(chart.showValues ? data : []) },
        insert: function () { return this.append('text').attr('class', 'gca-bar-value') },
        events: {
          'merge': function () {
            var horizontal = chart.orientation === 'horizontal'
            this
              .attr('x', function (d) { return horizontal ? d.x + d.w + 6 : d.x + d.w / 2 })
              .attr('y', function (d) { return horizontal ? d.y + d.h / 2 : d.y - 6 })
              .attr('dy', horizontal ? '0.35em' : null)
              .attr('text-anchor', horizontal ? 'start' : 'middle')
              .text(function (d) { return chart.format(d.value) })
          }
        }
      })
    },

    // Bars are laid out in the chart's own scales; subclasses/instances set orientation
    transform: function (data) {
      var m = this.margin
      var width = this.width() - m.left - m.right
      var height = this.height() - m.top - m.bottom
      var horizontal = this.orientation === 'horizontal'
      var max = d3.max(data, function (d) { return d.value })
      var band = d3.scale.ordinal().domain(data.map(function (d) { return d.label })).rangeRoundBands(horizontal ? [0, height] : [0, width], 0.25)
      var linear = d3.scale.linear().domain([0, this.max || max]).nice().range(horizontal ? [0, width] : [height, 0])

      this.plot.attr('transform', 'translate(' + m.left + ',' + m.top + ')')
      this.axisX.attr('transform', 'translate(' + m.left + ',' + (m.top + height) + ')')
      this.axisY.attr('transform', 'translate(' + m.left + ',' + m.top + ')')

      if (horizontal) {
        this.axisX.call(d3.svg.axis().scale(linear).orient('bottom').ticks(5).tickFormat(this.format).tickSize(-height, 0))
        this.axisY.call(d3.svg.axis().scale(band).orient('left').tickSize(0).tickPadding(8))
      } else {
        this.axisX.call(d3.svg.axis().scale(band).orient('bottom').tickSize(0).tickPadding(8))
        this.axisY.call(d3.svg.axis().scale(linear).orient('left').ticks(5).tickFormat(this.format).tickSize(-width, 0))
      }

      return data.map(function (d, i) {
        var o = { label: d.label, value: d.value, colour: d.colour }
        if (horizontal) {
          o.x = 0; o.y = band(d.label); o.w = linear(d.value); o.h = band.rangeBand()
        } else {
          o.x = band(d.label); o.y = linear(d.value); o.w = band.rangeBand(); o.h = height - linear(d.value)
        }
        return o
      })
    },

    styleBars: function (selection) {
      selection
        .attr('x', function (d) { return d.x })
        .attr('y', function (d) { return d.y })
        .attr('width', function (d) { return d.w })
        .attr('height', function (d) { return d.h })
        .attr('fill', function (d) { return d.colour })
    }
  })

  // Stacked columns: each datum is { label, parts: [{ name, value, colour }] }
  d3.chart('GcaChart').extend('GcaStackedChart', {
    initialize: function () {
      var chart = this
      this.margin = { top: 10, right: 20, bottom: 40, left: 60 }
      this.axisX = this.base.append('g').attr('class', 'gca-axis gca-axis--x')
      this.axisY = this.base.append('g').attr('class', 'gca-axis gca-axis--y')
      this.plot = this.base.append('g')

      this.layer('bars', this.plot.append('g'), {
        dataBind: function (data) { return this.selectAll('rect').data(data) },
        insert: function () { return this.append('rect') },
        events: {
          'merge': function () {
            this.attr('x', function (d) { return d.x }).attr('y', function (d) { return d.y })
              .attr('width', function (d) { return d.w }).attr('height', function (d) { return d.h })
              .attr('fill', function (d) { return d.colour })
          }
        }
      })
    },

    transform: function (data) {
      var m = this.margin
      var width = this.width() - m.left - m.right
      var height = this.height() - m.top - m.bottom
      var max = d3.max(data, function (d) { return d3.sum(d.parts, function (p) { return p.value }) })
      var x = d3.scale.ordinal().domain(data.map(function (d) { return d.label })).rangeRoundBands([0, width], 0.4)
      var y = d3.scale.linear().domain([0, max]).nice().range([height, 0])

      this.plot.attr('transform', 'translate(' + m.left + ',' + m.top + ')')
      this.axisX.attr('transform', 'translate(' + m.left + ',' + (m.top + height) + ')').call(d3.svg.axis().scale(x).orient('bottom').tickSize(0).tickPadding(8))
      this.axisY.attr('transform', 'translate(' + m.left + ',' + m.top + ')').call(d3.svg.axis().scale(y).orient('left').ticks(5).tickFormat(this.format).tickSize(-width, 0))

      var out = []
      data.forEach(function (d) {
        var total = 0
        d.parts.forEach(function (p) {
          out.push({ x: x(d.label), y: y(total + p.value), w: x.rangeBand(), h: y(total) - y(total + p.value), colour: p.colour })
          total += p.value
        })
      })
      return out
    }
  })

  // Donut: each datum is { label, value, colour, textColour }; values are shown as shares of the total
  d3.chart('GcaChart').extend('GcaDonutChart', {
    initialize: function () {
      var chart = this
      this.plot = this.base.append('g')

      this.layer('arcs', this.plot.append('g'), {
        dataBind: function (data) { return this.selectAll('path').data(data) },
        insert: function () { return this.append('path') },
        events: {
          'merge': function () {
            this.attr('d', function (d) { return d.path }).attr('fill', function (d) { return d.colour })
          }
        }
      })

      this.layer('shares', this.plot.append('g'), {
        dataBind: function (data) { return this.selectAll('text').data(data) },
        insert: function () { return this.append('text').attr('class', 'gca-donut-share') },
        events: {
          'merge': function () {
            this.attr('x', function (d) { return d.centroid[0] }).attr('y', function (d) { return d.centroid[1] })
              .attr('dy', '0.35em').attr('text-anchor', 'middle')
              .style('fill', function (d) { return d.textColour })
              .text(function (d) { return d.share })
          }
        }
      })

      this.layer('leaders', this.plot.append('g'), {
        dataBind: function (data) { return this.selectAll('polyline').data(data) },
        insert: function () { return this.append('polyline').attr('class', 'gca-donut-leader') },
        events: {
          'merge': function () { this.attr('points', function (d) { return d.leader }) }
        }
      })

      this.layer('names', this.plot.append('g'), {
        dataBind: function (data) { return this.selectAll('text').data(data) },
        insert: function () { return this.append('text').attr('class', 'gca-donut-name') },
        events: {
          'merge': function () {
            this.attr('x', function (d) { return d.nameX }).attr('y', function (d) { return d.nameY })
              .attr('text-anchor', function (d) { return d.anchor })
              .each(function (d) {
                var text = d3.select(this)
                text.selectAll('tspan').remove()
                d.nameLines.forEach(function (line, i) {
                  text.append('tspan').attr('x', d.nameX).attr('dy', i === 0 ? '0em' : '1.2em').text(line)
                })
              })
          }
        }
      })
    },

    transform: function (data) {
      var w = this.width()
      var h = this.height()
      var outer = Math.min(w, h) / 2 - 20
      var inner = outer * 0.52
      var arc = d3.svg.arc().innerRadius(inner).outerRadius(outer).padAngle(0.02)
      var total = d3.sum(data, function (d) { return d.value })
      var pie = d3.layout.pie().sort(null).value(function (d) { return d.value })

      this.plot.attr('transform', 'translate(' + w / 2 + ',' + h / 2 + ')')

      return pie(data).map(function (slice) {
        var d = slice.data
        var angle = (slice.startAngle + slice.endAngle) / 2
        var side = Math.sin(angle) >= 0 ? 1 : -1
        var edge = [Math.sin(angle) * outer, -Math.cos(angle) * outer]
        var elbow = [Math.sin(angle) * (outer + 14), -Math.cos(angle) * (outer + 14)]
        var end = [elbow[0] + side * 12, elbow[1]]
        var words = d.label.split(' ')
        var lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : words

        return {
          path: arc(slice),
          centroid: arc.centroid(slice),
          share: d3.format('.1f')(d.value / total * 100) + '%',
          colour: d.colour,
          textColour: d.textColour || '#0b0c0c',
          leader: [edge, elbow, end].map(function (point) { return point.join(',') }).join(' '),
          nameX: end[0] + side * 4,
          nameY: end[1] - (lines.length - 1) * 8,
          anchor: side > 0 ? 'start' : 'end',
          nameLines: lines
        }
      })
    }
  })

  // Creates an svg in `selector`, applies the named chart and draws `data`
  window.drawOrganisationChart = function (selector, chartName, data, options) {
    var el = document.querySelector(selector)
    var w = options.width
    var h = options.height
    var svg = d3.select(el).append('svg')
      .attr('viewBox', '0 0 ' + w + ' ' + h)
      .attr('width', '100%')
      .attr('role', 'img')
      .attr('aria-label', options.label)
    var chart = svg.append('g').chart(chartName)
    chart.width(w).height(h)
    if (options.margin) chart.margin = options.margin
    if (options.orientation) chart.orientation = options.orientation
    if (options.format) chart.format = formats[options.format]
    if (options.showValues) chart.showValues = true
    chart.draw(data)
  }

  window.organisationColours = colours
})(window.d3)

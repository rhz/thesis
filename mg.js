function go() {
  $("#results").empty();
  var [gast, hast] = parseGraphs();
  var g = buildGraph(gast),
      h = buildGraph(hast);
  intersections(g, h);
}

function parseGraphs() {
  var P = Parsimmon;
  function token(p) {
    return p.skip(P.optWhitespace);
  }
  function parens(p) {
    return P.string("(").then(p).skip(P.string(")"));
  }
  var nat = P.regexp(/[0-9]+/),
      name = P.regexp(/[a-zA-Z0-9]+/),
      bond = P.string("!").then(nat).fallback(null),
      site = P.seqMap(name, bond, (s, b) => ({site: s, bond: b})),
      comma = token(P.string(",")),
      sites = parens(P.sepBy(site, comma)),
      agent = P.seqMap(name, sites, (a, s) => ({agent: a, sites: s})),
      graph = P.sepBy1(agent, comma);
  var gin = $("input[name=g]").val(),
      hin = $("input[name=h]").val();
  var gres = graph.parse(gin),
      hres = graph.parse(hin);
  if (gres.status && hres.status) {
    return [gres.value, hres.value];
  } else {
    if (!gres.status)
      addError("error parsing <strong>g</strong>: " +
               P.formatError(gin, gres));
    if (!hres.status)
      addError("error parsing <strong>h</strong>: " +
               P.formatError(hin, hres));
  }
}

function addError(error) {
  $("#results").append(
    `<div class="col-md-10 col-md-offset-1">` +
    `<div class="alert alert-danger" role="alert">` +
    `${error}</div></div>`);
}

function buildGraph(g) {
  var agents = [],
      sites = [],
      sitemap = [],
      sitesOf = [], // inverse of sitemap
      edges = [],
      edgemap = {}, // returns y if x is given and (x,y) or (y,x) in edges
      agenttype = [],
      sitetype = [],
      bonds = {},
      sid = 0;
  for (var i = 0; i < g.length; i++) {
    agents.push(i);
    sitesOf.push([]);
    var a = g[i].agent;
    agenttype.push(a);
    var stypes = new Set();
    for (var j = 0; j < g[i].sites.length; j++) {
      sites.push(sid);
      sitemap.push(i);
      sitesOf[i].push(sid);
      var s = g[i].sites[j];
      // check that sites are not repeated
      if (stypes.has(s.site))
        return addError(`agent ${a} has more than one site ${s.site}`);
      else
        stypes.add(s.site);
      sitetype.push(a + "." + s.site);
      if (s.bond) {
        if (s.bond in bonds) {
          var nb = bonds[s.bond];
          edges.push([nb, sid]);
          delete bonds[s.bond];
          edgemap[sid] = nb;
          edgemap[nb] = sid;
        } else {
          bonds[s.bond] = sid;
        }
      }
      sid++;
    }
  }
  return { agents: agents,
           sites: sites,
           sitemap: sitemap,
           sitesOf: sitesOf,
           edges: edges,
           edgemap: edgemap,
           agenttype: agenttype,
           sitetype: sitetype };
}

function buildContactGraph(gs) {
  return { agents: new Set(flatten(gs.map(g => g.agenttype))),
           sites: new Set(flatten(gs.map(g => g.sitetype))) };
}

function flatten(xss) {
  return xss.reduce((xs, ys) => xs.concat(ys), []);
}

// the following function isn't used anymore
// but it's cool to have around
// cartesian product
function cartesian() {
  var args = Array.from(arguments);
  return args.reduce(
    (a, b) => flatten(a.map(
      x => b.map(y => x.concat([y])))),
    [ [] ]);
}

function powerset(xs) {
  if (xs.length == 0) return [ [] ];
  else {
    // var x = xs.shift(), ys = powerset(xs);
    var [x, ...rest] = xs, ys = powerset(rest);
    return ys.concat(ys.map(y => y.concat([x])));
  }
}

// from an array of arrays it construct another array of arrays
// in which there's one element of each one of the given arrays.
// it's like a non-deterministic zip.
function cross(xss, seen = new Set()) {
  if (xss.length == 0) return [ [] ];
  else {
    var [xs, ...rest] = xss;
    return xs.filter(([x, y]) => !seen.has(y)).map(
      ([x, y]) => flatten(cross(rest, new Set(seen).add(y)).map(
        ys => [ [x, y] ].concat(ys))));
  }
}

// lodash saved me from this nightmare
function nub(xs) {
  return _.uniqWith(xs, _.isEqual);
}

// cap as in the latex symbol for intersection
// set intersection
function cap(xs, ys) {
  return xs.reduce((a, x) => ys.includes(x) ? [x].concat(a) : a, []);
}

// for easy debugging
function d() {
  console.log(...arguments);
  return arguments[arguments.length-1];
}

function alias(x, f) { return f(x); }

// like `x in xs` but uses _.isEqual
function eqIn(x, xs) {
  return xs.some(y => _.isEqual(x, y));
}

// graph (multi-)intersections
function intersections(g, h) {
  // construct sets of type-compatible agent pairs
  // first get the type-compatible pairs
  var t = g.agents.map(x => h.agents.filter(
    y => g.agenttype[x] === h.agenttype[y]).map(
      y => [x, y]));
  // ais is an array of arrays, each array ai with as many elements
  // as agents in the intersection represented by ai.
  var ais = nub(flatten(cross(t).map(ai => powerset(ai))));
  console.log("ais", ais);
  // construct sets of type- and agent-compatible site pairs
  // sis is an array of arrays, each array si with as many elements
  // as agents in the intersection. then each agent array in si
  // has as many elements as sites that agent has in the intersection.
  var sis = ais.map(
    ai => ai.map(
      ([a, b]) => { var tys = {};
                    h.sitesOf[b].forEach(
                      y => tys[h.sitetype[y]] = y);
                    // maximal set of type-compatible sites
                    return g.sitesOf[a].reduce(
                      (xys, x) => {
                        var tx = g.sitetype[x];
                        // only take type-compatible sites
                        if (tx in tys)
                          return [ [x, tys[tx]] ].concat(xys);
                        else return xys;
                      }, []);
                  }));
  console.log("sis", sis);
  // discard by edge incompatibility
  // mis is an array of pairs [ai, si], ai and si as above.
  var mis = _.zip(ais, sis).filter(
    ([ai, si]) => alias(
      flatten(si),
      sitePairs => si.every(a => a.every(
        ([x, y]) => x in g.edgemap ?
          (y in h.edgemap &&
           eqIn([g.edgemap[x], h.edgemap[y]], sitePairs))
          : !(y in h.edgemap)))));
  console.log("mis", mis);
  // create the pullback graphs
  var ps = mis.map(([ai, si]) => {
    var sitemap = [], sitesOf = [], sid = 0;
    for (var i in si) {
      sitesOf.push([]);
      for (var j in si[i]) {
        sitemap[sid] = i;
        sitesOf[i].push(sid);
        sid++;
      }
    }
    var sites = flatten(si);
    var edges = [], edgemap = {};
    sites.forEach(([x, y], i) => {
      if (x in g.edgemap) {
        var nb = [g.edgemap[x], h.edgemap[y]],
            j = sites.findIndex(s => _.isEqual(s, nb));
        edges.push([i, j]);
        edgemap[i] = j;
        edgemap[j] = i;
      }
    });
    return { agents: ai,
             sites: sites,
             sitemap: sitemap,
             sitesOf: sitesOf,
             edges: edges,
             edgemap: edgemap,
             agenttype: ai.map(([a, b]) => g.agenttype[a]),
             sitetype: sites.map(([x, y]) => g.sitetype[x]) }; });
  console.log("ps", ps);
  ps.forEach(p => console.log("p", toString(p)));
  return ps;
}

function toString(g) {
  var agents = [],
      eid = 0,
      bond = {};
  for (var i in g.agents) {
    var sites = [];
    for (let j of g.sitesOf[i]) {
      var site = g.sitetype[j].split(".")[1];
      if (j in g.edgemap) {
        if (g.edgemap[j] in bond) {
          site += "!" + bond[g.edgemap[j]];
          delete bond[g.edgemap[j]];
        } else {
          site += "!" + eid;
          bond[j] = eid;
          eid++;
        }
      }
      sites.push(site);
    }
    agents.push(`${g.agenttype[i]}(${sites.join()})`);
  }
  return agents.join();
}


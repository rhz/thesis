function go() {
  $("#results").empty();
  var [gast, hast] = parseGraphs();
  var g = buildGraph(gast),
      h = buildGraph(hast);
  var ps = intersections(g, h);
  var us = unions(g, h);
  addResults(_.zip(ps, us));
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
  // sitemap, sitesOf, edges, edgemap, agenttype and sitetype
  // should refer to agents and site by their index in the
  // agents and sites arrays.
  // TODO: didn't use edges in the end, edgemap is enough.
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
  var t = g.agents.map((a, i) => h.agents.filter(
    (b, j) => g.agenttype[i] === h.agenttype[j]).map(
      (b, j) => [i, j]));
  // ais is an array of arrays, each array ai with as many elements
  // as agents in the intersection represented by ai.
  var ais = nub(flatten(cross(t).map(ai => powerset(ai))));
  // construct sets of type- and agent-compatible site pairs
  // sis is an array of arrays, each array si with as many elements
  // as agents in the intersection. then each agent array in si
  // has as many elements as sites that agent has in the intersection.
  var sis = ais.map(ai => ai.map(
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
  // create the pullback graphs
  return mis.map(([ai, si]) => {
    var sitemap = [], sitesOf = [];
    si.forEach((xs, i) => {
      sitesOf.push([]);
      xs.forEach(x => {
        sitesOf[i].push(sitemap.length);
        sitemap.push(i);
      });
    });
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
}

function or(x, y) { return _.isEmpty(x) ? y : x; }

// graph (multi-)unions
function unions(g, h) {
  // there's a bijection between intersections and unions
  return intersections(g, h).map(p => {
    var sl = p.sites.length,
        al = p.agents.length,
        [pa1, pa2] = or(_.unzip(p.agents), [[], []]),
        [ps1, ps2] = or(_.unzip(p.sites), [[], []]);
    // agents that have to be added
    // are those in g and h that are not in p.
    var a1 = _.difference(Array.from(g.agents.keys()), pa1),
        a2 = _.difference(Array.from(h.agents.keys()), pa2);
    // map agents in g and h to those in the union
    // we offset the agent indices due to the concatenation
    // of arrays p.agents.concat(a1).concat(a2)
    var ga_mg = g.agents.map(
          (a, i) => pa1.includes(i) ?
            pa1.indexOf(i) : a1.indexOf(i) + al),
        ha_mg = h.agents.map(
          (a, i) => pa2.includes(i) ?
            pa2.indexOf(i) : a2.indexOf(i) + al + a1.length);
    // same for sites
    var s1 = _.difference(Array.from(g.sites.keys()), ps1),
        s2 = _.difference(Array.from(h.sites.keys()), ps2);
    var gs_mg = g.sites.map(
          (x, i) => ps1.includes(i) ?
            ps1.indexOf(i) : s1.indexOf(i) + sl),
        hs_mg = h.sites.map(
          (y, i) => ps2.includes(i) ?
            ps2.indexOf(i) : s2.indexOf(i) + sl + s1.length);
    // map agent and site types
    var at1 = a1.map(a => g.agenttype[a]),
        at2 = a2.map(b => h.agenttype[b]);
    var st1 = s1.map(x => g.sitetype[x]),
        st2 = s2.map(y => h.sitetype[y]);
    // sitemap
    var sm1 = s1.map(x => ga_mg[g.sitemap[x]]),
        sm2 = s2.map(y => ha_mg[h.sitemap[y]]);
    // sitesOf (inverse of sitemap)
    var so1 = a1.map(a => g.sitesOf[a].map(x => gs_mg[x])),
        so2 = a2.map(b => h.sitesOf[b].map(y => hs_mg[y])),
        so3 = p.agents.map(([a, b]) => {
          var xs = g.sitesOf[a].map(x => gs_mg[x]),
              ys = h.sitesOf[b].map(y => hs_mg[y]);
          return nub(xs.concat(ys));
        });
    // new edges are obtained by offseting the indices
    var edgemap = p.edgemap;
    function addEdges(si, g, offset) {
      s1.forEach((x, i) => {
        if (x in g.edgemap)
          // g.edgemap[x] must be in si because all sites
          // coming from p are either already bound or free.
          // remember that sites in si might belong to
          // agents that come from p.
          edgemap[i + offset] = g.edgemap[x] + offset;
      });
    }
    addEdges(s1, g, sl);
    addEdges(s2, h, sl + sm1.length);
    // create the graph
    return { agents: p.agents.concat(a1).concat(a2),
             sites: p.sites.concat(s1).concat(s2),
             sitemap: p.sitemap.concat(sm1).concat(sm2),
             sitesOf: so3.concat(so1).concat(so2),
             edges: _.toPairs(edgemap).map(
               ([x, y]) => [_.toNumber(x), y]),
             edgemap: edgemap,
             agenttype: p.agenttype.concat(at1).concat(at2),
             sitetype: p.sitetype.concat(st1).concat(st2) };
  });
}

function addCol() {
  return $("#results").append(
    `<div class="col-md-12"></div>`).find("div");
}

function addResults(mgs) {
  var col = addCol();
  _.chunk(mgs, 2).forEach(res => addRow(col, res));
  col.find(".glyphicon").css("margin-top", "10px");
  col.find(".row").css("margin-top", "100px");
}

function addRow(ctn, res) {
  var p1, m1, p2, m2;
  if (res.length == 2) [[p1, m1], [p2, m2]] = res;
  else [[p1, m1]] = res;
  if (res.length == 2) ctn.append(
    `<div class="row">${unionDiv(p1, m1)}${unionDiv(p2, m2)}</div>`);
  else ctn.append(
    `<div class="row">${unionDiv(p1, m1, 3)}</div>`);
}

function unionDiv(p, m, offset = 0) {
  var cls = offset == 0 ? "" : ` col-md-offset-${offset}`;
  return `<div class="col-md-6${cls}">
    <div class="centre alert alert-info" role="alert">${toString(p)}</div>
    <div class="centre glyphicon glyphicon-arrow-down"></div>
    <div class="centre alert alert-info" role="alert">${toString(m)}</div>
  </div>`;
}

function toString(g) {
  if (g.agents.length == 0) return "&empty;";
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


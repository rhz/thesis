var lastIdx = 1;
function addPattern() {
  lastIdx++;
  $(".energy-term").filter(":last").after(
    `<div class="row form-group vcentre energy-term">
       <div class="col-md-3" style="text-align: left">
         <label for="pat${lastIdx}">energy pattern ${lastIdx}</label>
       </div>
       <div class="col-md-5">
         <input class="form-control input-lg pattern" type="text"
                name="pat${lastIdx}" value="A(x!1),A(y!1,x!2),A(y!2)"/>
       </div>
       <div class="col-md-2">
         <label for="cost${lastIdx}">with cost</label>
       </div>
       <div class="col-md-2">
         <input class="form-control input-lg cost" type="text"
                name="cost${lastIdx}" value="1"/>
       </div>
     </div>`);
}

function vals(sel, f = x => x) {
  return $(sel).map(function() { return f($(this).val()); }).get();
}

function computeRefinements() {
  var [l, r] = parseGraphs(["lhs", "rhs"]).map(g => buildGraph(g)),
      costs = vals(".cost", c => _.toNumber(c)),
      patterns = vals(".pattern", p => buildGraph(parseGraph(
        p, `error parsing <strong>${p}</strong>: `))),
      mods = modsites(l, r),
      contactGraph = buildContactGraph([l, r].concat(patterns));
  // relevant minimal glueings
  function relevantUnions(g) { // g can be l or r
    return _.flatten(patterns.map(
      p => unionsAndIntersections(g, p))).filter(
        ([u, i]) => isRelevant(i, mods)).map(_.first);
  }
  // site requests
  function siteRequests(rmgs) {
    return _.flatten(_.flatten(rmgs.map(m => m.ga_mg.map(
      (ma, ga) => _.difference(m.sitesOf[ma], m.gs_mg).map(
        ms => [ga, m.sitetype[ms]])))));
  }
  //
  // // compute a summary graph (contact graph where agent types
  // // can be repeated) annotated with site requests
  // function reqGraph(g) {
  //   // TODO: create all new subgraphs of g for which
  //   // we haven't checked site requests
  //   // g.toCheck[a] => create subgraph by adding
  //   // g.apath[a] and [the rest non-deterministically]
  //   var lreqs = siteRequests(relevantUnions(l)),
  //       rreqs = siteRequests(relevantUnions(r)),
  //       areqs = _.unionWith(lreqs, rreqs, _.isEqual);
  //   function addSiteRG(a, x) {
  //     var xid = g.sites.length;
  //     g.sites.push(x);
  //     g.sitesOf[a].push(xid);
  //     g.sitemap[xid] = a;
  //     g.edgemap[xid] = [];
  //     return xid;
  //   }
  //   function addAgentRG(at) {
  //     var a = g.agents.length;
  //     g.agents.push(at);
  //     g.sitesOf[a] = [];
  //     return a;
  //   }
  //   function addEdgeRG(xid, yid) {
  //     g.edgemap[xid].push(yid);
  //     g.edgemap[yid].push(xid);
  //     g.edges.push([xid, yid]);
  //   }
  //   areqs.forEach(([a, x]) => {
  //     var xid = addSiteRG(a, x);
  //     if (xid in g.spath)
  //       console.log("xid", xid, "in g.spath:", g.spath);
  //     else
  //       g.spath[xid] = g.apath[a].concat([x]);
  //     contactGraph.edgemap[x].forEach(y => {
  //       var b = addAgentRG(y.split(".")[0]);
  //       var yid = addSiteRG(b, y);
  //       if (yid in g.spath)
  //         console.log("yid", yid, "in g.spath:", g.spath);
  //       else
  //         g.spath[yid] = g.spath[xid].concat([y]);
  //       g.toCheck.push(yid);
  //       // TODO: deal with multiple paths
  //       if (b in g.apath)
  //         console.log("agent", b, "in g.apath:", g.apath);
  //       else
  //         g.apath[b] = g.spath[yid];
  //       addEdgeRG(xid, yid);
  //     });
  //   });
  //   console.log("g", g);
  //   console.log("g.apath", g.apath);
  //   console.log("g.spath", g.spath);
  //   var lsites = _.flatten(l.agents.map(
  //     a => _.difference(g.sitesOf[a], mods)));
  //   console.log("lsites", lsites);
  //   // compute subgraphs using the sites in g.toCheck
  //   // as starting points: they have to include their
  //   // path to the original rule and non-deterministically
  //   // add all other paths
  //   var subs = g.toCheck.map(); // ...
  //   // NOTE: perhaps apath and spath are useless, i just need a map
  //   // from the agents and sites in the subgraph to those in g
  // }
  // var initialRG = _.cloneDeep(l);
  // initialRG.toCheck = [];
  // initialRG.agents = l.agenttype;
  // initialRG.sites = l.sitetype;
  // _.unset(initialRG, "agenttype");
  // _.unset(initialRG, "sitetype");
  // initialRG.apath = {};
  // initialRG.spath = {};
  // initialRG.agents.map(
  //   (a, i) => initialRG.apath[i] = [i]);
  // initialRG.sites.map(
  //   (x, j) => initialRG.spath[j] = [initialRG.sitemap[j],
  //                                   initialRG.sites[j]]);
  // reqGraph(initialRG);
  //
  // add site requests iteratively
  function iter(queue, refs) {
    if (queue.length == 0)
      return refs;
    var [[l, r, reqs], ...rest] = queue,
        lreqs = siteRequests(relevantUnions(l)),
        rreqs = siteRequests(relevantUnions(r)),
        nreqs = _.unionWith(reqs, lreqs, rreqs, _.isEqual);
    if (nreqs.length == 0)
      // found a refinement
      return iter(rest, refs.concat([[l, r]]));
    // console.log("requested sites", nreqs.map(
    //   r => r.join(".")).join(", "));
    var [[a, x], ...reqtail] = nreqs;
    // add requested site to l and r
    // free first
    var lf = addFree(_.cloneDeep(l), a, x),
        rf = addFree(_.cloneDeep(r), a, x),
        free = [lf, rf];
    // console.log("lf", toString(lf), lf);
    // bound next
    function add(a, x, ys, f) {
      return ys.map(y => {
        var ly = f(_.cloneDeep(l), a, x, y),
            ry = f(_.cloneDeep(r), a, x, y);
        // console.log("ly", toString(ly), ly);
        return [ly, ry];
      });
    }
    var bound = add(a, x, contactGraph.edgemap[x], addBound);
    // loops now
    var loops = _.flatten(contactGraph.edgemap[x].map(y => {
      // select all sites in l that are of type y
      // and are not modified by the rule
      // and that are free
      var allys = _.compact(l.sitetype.map((z, i) => (y == z) && i)),
          boundsites = _.keys(l.edgemap).map(_.toNumber),
          yids = _.difference(allys, mods, boundsites);
      // handle the case where a site of type y is not in l
      // but could be added to an agent of y
      // and the site is not requested by the growth policy
      // (which means that the link would never be produced
      //  if we don't create it here)
      // TODO: is this case handled in the manuscript?
      var bt = y.split(".")[0],
          bs = _.compact(l.agenttype.map((at, i) => (at == bt) && i)),
          bs2 = bs.filter(b => l.sitesOf[b].every(
            z => l.sitetype[z] != y)),
          bs3 = bs2.filter(b => reqtail.every(
            ([c, z]) => b != c && y != z));
      return add(a, x, yids, addLoop).concat(
        add(a, x, bs3.map(b => [b, y]), addBoundIn));
    }));
    var exts = [free].concat(bound, loops).map(
      x => x.concat([reqtail]));
    return iter(rest.concat(exts), refs);
  }
  var refs = iter([[l, r, []]], []);
  showRefinements(refs);
}

// add a site of type x in agent a
// bound to site of type y in agent b
function addBoundIn(g, a, x, b, y) {
  var xid = addSite(g, a, x),
      yid = addSite(g, b, y);
  return addEdge(g, xid, yid);
}

// add a site of type x in agent a bound to site yid
function addLoop(g, a, x, yid) {
  var xid = addSite(g, a, x);
  return addEdge(g, xid, yid);
}

// add a free site of type x in agent a in graph g
function addFree(g, a, x) {
  addSite(g, a, x);
  return g;
}

// add a site of type x in agent a bound to site y
function addBound(g, a, x, y) {
  var b = addAgent(g, y.split(".")[0]),
      xid = addSite(g, a, x),
      yid = addSite(g, b, y);
  return addEdge(g, xid, yid);
}

// add agent of type at to graph g and return agent id
function addAgent(g, at) {
  var a = g.agents.length;
  g.agenttype.push(at);
  g.agents.push(at);
  g.sitesOf[a] = [];
  return a;
}

// add site of type x to agent a and return site id
function addSite(g, a, x) {
  var xid = g.sites.length;
  g.sitetype.push(x);
  g.sites.push(x);
  g.sitesOf[a].push(xid);
  g.sitemap[xid] = a;
  return xid;
}

// add edge between sites xid and yid
function addEdge(g, xid, yid) {
  g.edgemap[xid] = yid;
  g.edgemap[yid] = xid;
  g.edges.push([xid, yid]);
  return g;
}

function showRefinements(refs) {
  var col = $("#results").append(
    `<div class="col-md-12"></div>`).find("div");
  col.append(
    `<div class="row">
       <div class="col-md-11 col-md-offset-1">
         <h5>Refinements</h5>
       </div>
     </div>`);
  refs.forEach(([l, r], i) => col.append(
    `<div class="row vcentre">
       <div class="col-md-1">
         ${i+1}
       </div>
       <div class="col-md-5">
         <div class="centre alert alert-info" role="alert">
           ${toString(l)}
         </div>
       </div>
       <div class="col-md-1">
         <span class="glyphicon glyphicon-arrow-right"/>
       </div>
       <div class="col-md-5">
         <div class="centre alert alert-info" role="alert">
           ${toString(r)}
         </div>
       </div>
     </div>`));
  col.append(
    `<div class="row">
       <div class="col-md-11 col-md-offset-1">
         <button class="btn btn-default btn-lg" name="download"
                 onclick="downloadKaSim();">
           Download KaSim code
         </button>
       </div>
     </div>`);
}

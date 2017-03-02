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
    // console.log("l", toString(l), l);
    // console.log("requested sites", nreqs.map(
    //   r => r.join(".")).join(", "));
    // console.log("reqs", reqs.map(
    //   r => r.join(".")).join(", "));
    // console.log("lreqs", lreqs.map(
    //   r => r.join(".")).join(", "));
    // console.log("rreqs", rreqs.map(
    //   r => r.join(".")).join(", "));
    var [[a, x], ...reqtail] = nreqs;
    // add requested site to l and r
    // free first
    var lf = addFree(_.cloneDeep(l), a, x),
        rf = addFree(_.cloneDeep(r), a, x),
        free = [lf, rf, reqtail];
    // console.log("lf", toString(lf), lf);
    // bound next
    var bound = contactGraph.edgemap[x].map(y => {
      var lb = addBound(_.cloneDeep(l), a, x, y),
          rb = addBound(_.cloneDeep(r), a, x, y);
      // console.log("lb", toString(lb), lb);
      return [lb, rb, reqtail];
    });
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
      //  if we don't create here)
      // TODO: is this case handled in the manuscript?
      var bt = y.split(".")[0],
          bs = _.compact(l.agenttype.map((at, i) => (at == bt) && i)),
          bs2 = bs.filter(b => l.sitesOf[b].every(
            z => l.sitetype[z] != y)),
          bs3 = bs2.filter(b => reqtail.every(
            ([c, z]) => b != c && y != z));
      return yids.map(yid => {
        var ll = addLoop(_.cloneDeep(l), a, x, yid),
            rl = addLoop(_.cloneDeep(r), a, x, yid);
        // console.log("ll", toString(ll), ll);
        return [ll, rl, reqtail];
      }).concat(bs3.map(b => {
        var ll = addBoundIn(_.cloneDeep(l), a, x, b, y),
            rl = addBoundIn(_.cloneDeep(r), a, x, b, y);
        console.log("adding sites", x, "in", x, "and", y, "in", b,
                    "then linking them generates", toString(ll), ll);
        return [ll, rl, reqtail];
      }));
    }));
    return iter(rest.concat([free], bound, loops), refs);
    // return iter(rest.concat(bound, loops), refs);
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

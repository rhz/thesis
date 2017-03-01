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
  console.log("contactGraph", contactGraph);
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
    var [[a, x], ...reqtail] = nreqs;
    // add requested site to l and r
    // free first
    var lf = addFree(_.cloneDeep(l), a, x),
        rf = addFree(_.cloneDeep(r), a, x),
        free = [lf, rf, reqtail];
    console.log("requested sites", nreqs.map(
      r => r.join(".")).join(", "));
    console.log("reqs", reqs.map(
      r => r.join(".")).join(", "), "...", reqs);
    console.log("lreqs", lreqs.map(
      r => r.join(".")).join(", "), "...", lreqs);
    console.log("rreqs", rreqs.map(
      r => r.join(".")).join(", "), "...", rreqs);
    console.log("lf", toString(lf), a, x);
    // bound next
    var bound = contactGraph.edgemap[x].map(y => {
      var lb = addBound(_.cloneDeep(l), a, x, y),
          rb = addBound(_.cloneDeep(r), a, x, y);
      return [lb, rb, reqtail];
    });
    // TODO: loops now
    var loops = [];
    return iter(rest.concat([free], bound, loops), refs);
  }
  // add a free site of type x in agent a in graph g
  function addFree(g, a, x) {
    var xid = g.sites.length;
    g.sitetype.push(x);
    g.sites.push(x);
    g.sitesOf[a].push(xid);
    g.sitemap[xid] = a;
    return g;
  }
  // add a site of type x in agent a bound to site y
  function addBound(g, a, x, y) {
    var bt = y.split(".")[0],
        b = g.agents.length,
        xid = g.sites.length,
        yid = xid+1;
    g.agenttype.push(bt);
    g.agents.push(bt);
    g.sitetype.push(x);
    g.sites.push(x);
    g.sitetype.push(y);
    g.sites.push(y);
    g.sitesOf[a].push(xid);
    g.sitemap[xid] = a;
    g.sitesOf[b] = [yid];
    g.sitemap[yid] = b;
    g.edgemap[xid] = yid;
    g.edgemap[yid] = xid;
    g.edges.push([xid, yid]);
    return g;
  }
  var refs = iter([[l, r, []]], []);
  // display refinements
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
         ${i}
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

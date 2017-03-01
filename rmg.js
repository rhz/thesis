function computeRmg() {
  $("#results").empty();
  var [g, l, r] = parseGraphs(["energy-pattern", "lhs", "rhs"]).map(
    g => buildGraph(g));
  var mods = modsites(l, r),
      lus = unions(l, g),
      rus = unions(r, g),
      lis = intersections(l, g),
      ris = intersections(r, g);
  var [lc, rc] = $("#results").append(
    `<div class="col-md-6"></div>
     <div class="col-md-6"></div>`).children();
  $(lc).append(
    `<h5>On the left-hand side</h5>`);
  $(rc).append(
    `<h5>On the right-hand side</h5>`);
  _.zip(lus, lis).forEach(
    ([m, p]) => addMg(m, $(lc), isRelevant(p, mods)));
  _.zip(rus, ris).forEach(
    ([m, p]) => addMg(m, $(rc), isRelevant(p, mods)));
}

function modsites(l, r) {
  var removed = _.difference(l.edges, r.edges),
      added = _.difference(r.edges, l.edges);
  return _.union(_.flatten(removed), _.flatten(added));
}

function isRelevant(i, mods) {
  return _.some(i.sites.map(_.first), x => mods.includes(x));
}

function addMg(m, div, relevant) {
  div.append(
    `<div class="centre alert alert-${relevant ? "success" : "info"}"
          role="alert" style="margin-top: 20px">
       ${toString(m)}
     </div>`);
}

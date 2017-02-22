set key autotitle columnhead at 49.5,900 spacing 2
set xlabel "Time (arbitrary units)"
set ylabel "Number of triangles"
set term tikz color standalone
set output 't-sa.tex'
plot "t-2.5/t-2.5.tsv" u 1:2 w l lw 2 dt 4 t "$\\epsilon(t) = -2.5$", "t-5/t-5.tsv" u 1:2 w l lw 2 dt 4 t "$\\epsilon(t) = -5$", "t-7.5/t-7.5.tsv" u 1:2 w l lw 2 dt 4 t "$\\epsilon(t) = -7.5$", "t-10/t-10.tsv" u 1:2 w l lw 2 dt 4 t "$\\epsilon(t) = -10$"

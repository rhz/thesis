set key autotitle columnhead at 280,28 spacing 2
set xlabel "Time (arbitrary units)"
set ylabel "Number of instances"
set term tikz color standalone
set output 'fe-sa.tex'
w=2
plot ARG1 u 1:2 w l lw w t "01", "" u 1:3 w l lw w t "Y", "" u 1:4 w l lw w t "0", "" u 1:5 w l lw w t "1" #, "" u 1:6 w l lw w t "PY"

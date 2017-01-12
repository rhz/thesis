#!/bin/sh

###
#
# texdeps.sh -- Generates LaTeX dependency info for GNU/Make
#
# This script extracts file-dependencies from LaTeX source files
# (*.tex) and produces output in Makefile format suitable for
# GNU/Make.  Typically, the output generated by this script from some
# PDF file `foo.pdf' with LaTeX source `foo.tex' is stored in a
# dependency file `foo.P' that can then be automatically included in a
# top-level Makefile through a statement such as
#
#   include $(PDFS:%.pdf=$(DEPSDIR)/%.P)
#
# The Makefile should also contain some rule(s) to update `foo.P' (by
# re-running this this script) whenever `foo.pdf' is generated, e.g.
#
#   %.pdf: %.tex
#          ./texdeps.sh $@ $< > $*.P   # <--- update dependency file
#          pdflatex $* && pdflatex $*
#
#
# Author: Sandro Stucki <sandro.stucki@gmail.com>
#
#


### Functions ###

# Print usage and exit
#
# Synopsis: exit_usage <exit code>
#
exit_usage() {
  echo "Usage: $0 PDFFILE [TEXFILE]" >&2
  exit $1
}


# Extract all file names appearing in a given LaTeX command from a
# given source file.  The result is stored in the variable `files'.
#
# Synopsis: extract_filenames <texfile> <command>
#
extract_filenames() {
  local src cmd sedcmd1 sedcmd2

  # Source file name
  src="$1"

  # LaTeX command/macro
  cmd="$2"

  # Filter
  sedcmd1='s/\\'"${cmd}"'\[[^]]*\]{\([^}][^}]*\)}/\1/g'
  sedcmd2='s/\\'"${cmd}"'{\([^}][^}]*\)}/\1/g'
  files="$(grep -Eo '^[^%]*' "${src}" \
      | grep -Eo '\\'"${cmd}"'(\[[^]]*\])?{[^}]+}' \
      | sed -e "${sedcmd1}; ${sedcmd2}" \
      | tr ',' ' ')"
}

# Check a list of file basenames against a list of extensions and add
# those combinations corresponding to existing files to the `res'
# variable.
#
# Synopsis: filter_filelist <dir> <filelist> <ext1> <ext2> ...
#
filter_filelist() {
  local d fs f x

  # Directory
  d="$1"
  shift

  # File list
  fs="$1"
  shift

  # Iterate through the directories/filenames/extensions and check
  # existence of files.
  for f in ${fs}; do
    for x in "$@"; do
      if [ -f "${d}${f}${x}" ]; then
        res="${res} ${d}${f}${x}"
        break;
      fi
    done
  done
}


# Check whether an array of strings <w1>, <w2>, ... contains the
# string <pat>.
#
# Synopsis: contains <pat> <w1> <w2> ...
#
contains() {
  local pat w
  pat="$1"
  shift

  for w in "$@"; do
    [ "${pat}" = "${w}" ] && return 0
  done
  return 1
}


### Start of main program ###

# Check if we got a PDF filename.
if [ -z "$1" ]; then
  exit_usage 1
fi
pdffile="$1"
pdfdir="$(dirname "${pdffile}")"
pdfbase="${pdfdir}/$(basename "${pdffile}" .pdf)"
shift 1

# Check if we got a .tex filename.
if [ -z "$1" ]; then
  texfile="${pdfbase}.tex"
else
  texfile="$1"
  shift 1
fi
texdir="$(dirname "${texfile}")"
texbase="${texdir}/$(basename "${texfile}" .tex)"

# Check if the .tex file is present, otherwise exit with an error.
if [ ! -f "${texfile}" ] ; then
  echo "File '${texfile}' not found!" >&2
  exit_usage 1
fi

# Init queue of files to be checked for dependencies as well as the
# list of dependencies found.
tocheck="${texfile}"
checked=""
deps=""
while [ -n "${tocheck}" ]; do

  # Iterate through all files in the queue and check their
  # dependencies.
  for file in ${tocheck}; do

    # Dound double-check files.
    contains "${file}" ${checked} && break

    # Extract file names from commands in .tex file.
    extract_filenames "${file}" 'usepackage'       # Packages
    pkgs="${files}"
    extract_filenames "${file}" 'input'            # \input{} files
    inputs="${files}"
    extract_filenames "${file}" 'include'          # \include{} files
    includes="${files}"
    extract_filenames "${file}" 'includegraphics'  # Images
    imgs="${files}"
    extract_filenames "${file}" 'bibliography'     # Bibliography files
    bibs="${files}"
    extract_filenames "${file}" 'addbibresource'   # Bibliography files
    birs="${files}"

    # Search for files in the current directory as well as the directory
    # that contains the .tex file.  Discard all other files.
    for dir in "" "${texdir}/"; do

      # Don't double check directories
      if [ "${dir}" = "./" ]; then break; fi

      # Filter the lists and build `deps'.  Schedule included
      # TeX sources and packages for recursive checks.
      res=""
      filter_filelist "${dir}" "${inputs} ${includes}" "" ".tex"
      filter_filelist "${dir}" "${pkgs}" "" ".sty"
      tocheck_next="${res}"  # Check includes recursively.
      filter_filelist "${dir}" "${imgs}" "" ".pdf" ".eps" ".jpg" \
                      ".jpeg" ".png"
      filter_filelist "${dir}" "${bibs} ${birs}" "" ".bib"
      deps="${deps}${res}"
    done
  done

  # Prepare for the next iteration.
  checked="${checked}${tocheck}"
  tocheck="${tocheck_next}"
done

# Output the dependency list in Makefile-format
if [ ! -z "${deps}" ]; then
  echo "${pdffile}:${deps}"
  for f in ${deps}; do
    echo "${f}:"
  done
fi

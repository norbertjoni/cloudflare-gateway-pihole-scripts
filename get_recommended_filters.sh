#!/bin/bash

# create an empty input.csv file
touch input.csv

# declare the url of the regex file
url="https://big.oisd.nl/regex"

# get the file name from the url
file=$(basename "$url")

# download the regex file with curl and save it as file.txt
curl -o "$file.txt" "$url"

# remove the lines starting with #
sed -i '/^#/d' "$file.txt"

# append the modified file contents to input.csv and add a newline
cat "$file.txt" >> input.csv
echo "" >> input.csv

# remove the file.txt
rm "$file.txt"

# print a message when done
echo "Done. The input.csv file contains data from the specified regex source, with lines starting with '#' removed."

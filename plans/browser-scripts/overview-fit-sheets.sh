D=D:/workspace/GameBuilder/plans/reports/shots-overview-fit
for p in hien-tai gan-vua rat-gan; do
  for v in desk phone; do
    files=$(ls $D/$v-$p-*.png | sed 's#^#D:#;s#^D:D:#D:#')
    node D:/workspace/GameBuilder/plans/browser-scripts/contact-sheet.mjs "$D/sheet-$p-$v.png" 2 600 $files
  done
done

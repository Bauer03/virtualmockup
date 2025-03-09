1) solved
 Sometimes, the copy to notebook button doesn't work. It adds an entry to the notebook just fine, but none of the data which should be populating that entry is acutally present, it just adds a bunch of zeros. 

2) solved
Switching tabs occasionally clears the contents of the 'basic', 'energy', and 'time' tabs. Sometimes, if I'm on the 'energy' tab in the output section and I switch to the notebook and back to the energy tab (all while the simulation is running) the energy tab will be empty. If I switch to other tabs, like time or basic, those will be empty too. This happens with all the tabs. Sometimes, however it works - I am not certain what causes this behavior. It ALWAYS happens with the time tab - if I'm not actively running a simlation and switch away from the time tab while it is populated with time values, it'll be 0s everywhere when I revisit it.

3) solved
 If a substance is currently being displayed (aka, if a substance is built), or if a run is in process, you should not be able to change any of the inputs from modelSetup, runDynamics, or the scripts. If a substance is built, you cannot for example change how many atoms there are, or how many runs, or the simulation type, etc etc.

4) solved (hopefully)
If a substance is destroyed, the canvas should be cleared to indicate that the substance is no longer built - as things are, it doesn't disappear after it's destroyed, it just stops working with the orbitcontrols and is no longer animated. After a run ends, I would also like for the 'run' button to be disabled, to show that the run is complete. This would go along with the existing toast notification that pops up at the end of the run. Really hope settign this up doesn't break some other part of the simulation

5) solved, mostly
 Right now, the colors for the atoms and the color for the bounding box of the atoms is wrong. Please make the atoms a light color and the bounding box a slightly less light color in dark mode, and make the atoms a dark color and the bounding box a slighly less dark color in light mode. Also, the notification for the end of a simulation does not go with my theme - I'd like for it only to have a small amount of green, and to otherwise use my app's theme colors.

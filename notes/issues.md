1) solved
 Sometimes, the copy to notebook button doesn't work. It adds an entry to the notebook just fine, but none of the data which should be populating that entry is acutally present, it just adds a bunch of zeros. 

2) solved
Switching tabs occasionally clears the contents of the 'basic', 'energy', and 'time' tabs. Sometimes, if I'm on the 'energy' tab in the output section and I switch to the notebook and back to the energy tab (all while the simulation is running) the energy tab will be empty. If I switch to other tabs, like time or basic, those will be empty too. This happens with all the tabs. Sometimes, however it works - I am not certain what causes this behavior. It ALWAYS happens with the time tab - if I'm not actively running a simlation and switch away from the time tab while it is populated with time values, it'll be 0s everywhere when I revisit it.

3) solved
 If a substance is currently being displayed (aka, if a substance is built), or if a run is in process, you should not be able to change any of the inputs from modelSetup, runDynamics, or the scripts. If a substance is built, you cannot for example change how many atoms there are, or how many runs, or the simulation type, etc etc.

4) solved (hopefully)
If a substance is destroyed, the canvas should be cleared to indicate that the substance is no longer built - as things are, it doesn't disappear after it's destroyed, it just stops working with the orbitcontrols and is no longer animated. After a run ends, I would also like for the 'run' button to be disabled, to show that the run is complete. This would go along with the existing toast notification that pops up at the end of the run. Really hope settign this up doesn't break some other part of the simulation

5) solved
 Right now, the colors for the atoms and the color for the bounding box of the atoms is wrong. Please make the atoms a light color and the bounding box a slightly less light color in dark mode, and make the atoms a dark color and the bounding box a slighly less dark color in light mode. Also, the notification for the end of a simulation does not go with my theme - I'd like for it only to have a small amount of green, and to otherwise use my app's theme colors.

6) solved
Currently, if I'm typing into the input in the scripts tab, and I try to delete the default input (1), I can't do that. While the scripts tab shouldn't be able to take in a number of runs <1, I'd still like to be able to delete the one and then, for example, add a '2' instead. I think this may be tied to a requirement for a minimum number of characters in the input box - I just want there to be a minimum of one character when submitted, not when typing.

7) solved
 I'd like some kind of "cancel" functionality for the scripts tab, in case the user inputs something wrong and doesn't want to sit through the (up to 500) runs that they'd be simulating. This cancellation feature would be something which lets the current run end, and then stops the next one from occurring. The button to trigger this would only be visible after the "run simulations" button has been clicked, and it would no longer be visible when all the simulations are run.

8) solved... allegedly
Currently, the 'scripts' tab doesn't seem to be working correctly. Does it properly simulate a run for every instance requested in the input tab (up to 500?). It doesn't seem to visually do anything - is it still making all the calculations associated with temperature, pressure, volume, etc? Is it only being simulated visually, or will it export stuff to the notebook like expected? Side note: is the notebook able to store over 500 runs? If not, there should be a way to notify the user that it's storing x out of y possible runs. Furthermore, if the number in the input from the scripts tab is higher than the available number of runs to be stored in the notebook, this should be communicated to the user properly. Furthermore, note that while the simulations are running, the 'build' and 'run' buttons are not disabled like they would be - clicking 'run simulations' should disable the build/run buttons, as in theory it's taking control of them and the user should not have control of these buttons until the simulations are over or canceled.

9) solved
 The 'time' information in the download previews is incorrect. While I do want that information to be downloaded when the button is pressed (as is the behavior right now), i don't want the user's inputted time information to be shown in the preview (as is also the case riht now). Instead, i want the outputted time calculated from the simulation to show up here. (This means I want time (ps), run time, total time (ps), total time to be shown instead). Also note, the downloads are currently formatted as intended. I just want to change the previews in the notebook.

10) solved
 When the user inputs something into atomic mass, I believe the atomic type should change to 'user', because to my knowledge, every atom has an associated atomic mass and if I gave a different atomic mass to helium, for example, it woudl no longer be helium. As long as this is true, please change it to be this way. Also, if there are any similar behaviors across the app (where changing an input would change one or more of the other parameters) these should change and be reflected visually.

 11) solved
 If the user builds a substance, all of the user inputs are disbled. however, this isn't the case if the potential model is set to either lennard-jones or soft-sphere - the sigma and epsilon fields aren't visually 'disabled', as if they had the disabled attribute on them. 

 12) solved
 The user should only be able to click 'copy to notebook' once the run completes. This means that if you start a run, and you're midway through, the button should be disabled. It should become enabled again after the run is done.

 13) solved (fix colors later)
 Next to the 'theme toggle' button, i'd like a 'help' button with an 'info' material-icon, which makes a popup appear. This popup will be overlaid over the entire app, and contain a simple, user-friendly breakdown of this app. the popup can be closed by clicking the background or a 'close' material-icon.

 14) not started
 I need the atoms in the simulation to all have outlines, so that they can be visually distinguished from one another. Furthermore, the angle at which the camera is by default isn't ideal, I'd like it to be a little backed up so I can see the bounding box of the simulation box (which is currently aligned with the edges of the viewport, as things are).

 15) not started
 The "cancel" feature in the scripts section doesn't work. When the button is pressed, the press is registered, but even after the ongoing run ends, the other runs continue, and their outputs continue to be registered in the notebook. I would like the ongoing simulation to finish, but not any others. So, if I press 'stop' on simulation 4/5, simulation 4 finishes, and simluation 5 does not start. This is not the current behavior of the web app.
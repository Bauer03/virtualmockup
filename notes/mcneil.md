## Intro
- These are talking points 

## New Lab documents?
 - I've improved the user experience in this app, at the cost of making the directions in the labs a little outdated. After looking at the lab, I saw a few ways to make the process simpler for students.
 - Example of improvement I made: there is now no need to copy and paste stuff into excel, the 'notebook' tab saves all the simulation runs you've copied to notebook semi-permanently (this is as good as I could get it without having the costs of a server associated with the app, more on 'semi-permanently' soon), and if you open the file in excel, all of your runs, with the parameters you selected, timestamps for the run, etc etc are automatically formatted. Of course, I can change this without too much of a hassle, so let me know if you have comments/suggestions with regards to this.
 - Should I rewrite the labs according to my new interface?

## "Semi" permanent storage?
 - As long as you don't clear your browser cache. If you disable all cookies from all sources (cough cough safari browser does this by default nowadays I think) there may be some issues saving data, but I haven't messed around with it yet. This can go on my to-do list.
 - To be clear, the data you save in your notebook will persist after you reboot your computer too, or if your browser crashes because I mis-optimized something. 
 - HOWEVER, the notebook storage is not permanent, and if you clear your browser cache, unless you're particularly tech-savvy, there's nothing you can do about losing all the runs you had saved in the notebook.
 - This really should be a non-issue. Cache is, to my knowledge, never randomly cleared. I would still recommend telling students to download their runs from the notebook as often as possible! Better safe than crushed after hours of runs being lost.
 - Also important: the data is stored on a single computer, on a single browser. Since I chose to implement this web-app without any servers of any kind, to minimize costs, I'm not storing any data on the cloud. TLDR: Only work from one browser (and from one device).

## The new interface
 To use this app:
 - Select whatever you'd like from the top left options. Whatever you ignore will be set to the same defaults as were selected in the original virtual substance app. (If you'd like different defaults selected, let me know, this is easy to implement).
 - There are three tabs from which you choose input options: Model Setup, Run Dynamics, and Scripts. The first two are easily understood, and work the same way as they did in the original app - the third replaces the Command Scripts section in the original Virtual Substance app. It allows the user to specify a number of runs (<=500). For each run, the command script will simulate and output the contents to the notebook. Please note 500 runs will make 500 rows, just a heads up. Will work, but will take a while and generate lots of stuff to scroll through. I'm working on a feature to 'cancel' a scripts run, which will finish the current run and then stop the next from occurring (eg: click 'cancel' on run 231/350, run 231 finishes, run 232 is prevented from starting). 
 
 Anyways, assuming you're doing things manually with your own custom inputs, and NOT using the scripts section: 
 - Press "build" to build the substance, generates all the atoms in the bounding box.
 - Once "build" is pressed, none of the input parameters are able to be changed. To change them, "discard" should be pressed, after which you can change your parameters, and click "build" again, to create a new substance with your updated parameters.
 - After the substance is built (and while the simulation runs, if you'd like), you can click and drag or scroll to zoom in/out inside the preview panel. I've added button controls for left,right,up,down, in case this simplifies things.
 - After you click "run", you can click "copy to notebook". This copies all the current output data to the notebook, including temperature, pressure, volume, total energy, kinetic energy, potential energy, time (ps), run time, total time... etc.
 - After you've clicked "copy to notebook", your run is saved to the notebook, with a timestamp. Saves all the outputs, and the selected inputs. If this is too much information to be saving to excel, I can reduce it - it's no hassle at all. I just wanted to make sure I wasn't excluding anything important. 
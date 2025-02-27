### Apology
 - This has taken way longer than I thought to create, because I've been busy this semester and gotten stuck multiple times. I know the following points can be a lot to suddenly have to process, hopefully it's not too confusing.
 - With that said, here are things I wanted to discuss after having rewritten the Virtual Substance app.

## New Lab documents?
 - I've (hopefully) improved the user experience in this app, at the cost of making the directions in the labs somewhat inaccurate, as my rewritten app doesn't have the same functionality in the command scripts tab, for example.
 - Example of improvement I made: there is now no need to copy and paste stuff into excel, the 'notebook' tab saves all the simulation runs you've copied to notebook semi-permanently (this is as good as I could get it without having the costs of a server associated with the app), and if you open the file in excel, all of your runs, with the parameters you selected, timestamps for the run, etc etc are automatically formatted. Of course, I can change this without too much of a hassle, so let me know if you have comments/suggestions with regards to this.
 - Should I rewrite the labs according to my new interface?

## "Semi" permanent storage?
 - As long as you don't clear your browser cache, that is. If you disable all cookies from all sources (cough cough safari browser does this by default nowadays I think) there may be some issues saving data, but I haven't messed around with it yet. This can go on my to-do list.
 - To be clear, the data you save in your notebook will persist after you reboot your computer too, or if your browser crashes because I mis-optimized something. 
 - HOWEVER, the notebook storage is not permanent, and if you clear your browser cache, unless you're particularly tech-savvy, there's nothing you can do about losing all the runs you had saved in the notebook.
 - This really should be a non-issue. Cache is, to my knowledge, never randomly cleared. I would still recommend telling students to download their runs from the notebook as often as possible! Better safe than crushed after hours of runs being lost.

## The new interface
 To use this app:
 - Select whatever you'd like from the top left options. Whatever you ignore will be set to the same defaults as were selected in the original virtual substance app. (If you'd like different defaults selected, let me know, this is easy to implement).
 - There are three tabs: Model Setup, Run Dynamics, and Scripts. The first two are easily understood - the third replaces the Command Scripts section in the original Virtual Substance app. It allows the user to specify a number of runs (<500). For each run, the command script will simulate and output the contents to the notebook. Please note 500 runs will make 500 rows, just a heads up. Will work, but will take a while and generate lots of stuff to scroll through.
 Anyways, assuming you're doing things manually with your own custom inputs: 
 - Press "build" to build the substance, generate all the atoms in the bounding box.
 - Once "build" is pressed, none of the input parameters are able to be changed. To change them, "discard" should be pressed, after which you can change your parameters, and click "build" again.
 - After the substance is built (and while the simulation runs, if you'd like), you can click and drag or scroll to zoom in/out inside the preview panel. If you'd prefer, I've added controls which do the same thing through mouse clicks.
 - After you click "run", you can click "copy to notebook". This copies all the current output data to the notebook, including temperature, pressure, volume, total energy, kinetic energy, potential energy, time (ps), run time, total time... etc.
 - After you've clicked "copy to notebook", your run is saved to the notebook, with a timestamp.
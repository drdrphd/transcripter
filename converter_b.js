///
/// converter.js
/// 
/// much loading code from: https://blog.soshace.com/the-ultimate-guide-to-drag-and-drop-image-uploading-with-pure-javascript/
/// 
/// ms conversion from: https://stackoverflow.com/questions/21294302/converting-milliseconds-to-minutes-and-seconds-with-javascript
/// 

//
// Data loaded in main.html
// from external (transcript_name).js
//
// Data structure:
//
// const tiers = Object {
//		"tier-id": {type: "...", parent_tier: "...", time_alignable: "...", constraints: "..."},
//		"tier-id": {type: "...", parent_tier: "...", time_alignable: "...", constraints: "..."},
//	... };
//
//	Possible values for the above: 	type = LINGUISTIC_TYPE_REF
//									parent_tier = (PARENT_REF, null)
//									time_alignable = (true, false)
//									constraints = (null, Time_subdivision, Symbolic_Subdivision, Symbolic_Association, Included_In)
//
//	const annotations = Object {
// 	  "Tier name": [
// 	        ["annotation id", "parent annotation id", [start_time, end_time], value],
// 	        ["annotation id", "parent annotation id", [start_time, end_time], value],
// 	         ...
// 	   ],
// 	   "Tier name": [ ... ],
//	   "Tier name": [ ... ],
// 	   ...
// 	};


window.onload = function(){
	
	var elan = new WebELAN();
	dragAndDropEAF();
	
	
	//
	// DRAG & DROP
	//
	function dragAndDropEAF() {
	
		const dropRegion = document.getElementById("user-input");

		// open file selector when clicked on the drop region
		const hiddenInput = document.createElement("input");
		hiddenInput.type = "file";
		hiddenInput.accept = ".eaf";
		hiddenInput.multiple = false;
		dropRegion.addEventListener('click', function() {
			hiddenInput.click();
		});
		
		//normal file loader is ugly -- keep hidden and just tie to drag and drop
		hiddenInput.addEventListener("change", function() {
			var file = hiddenInput.files[0];
			elan.loadEAF(file)
			.then(function() {
				onLoadEAF();
			})
			.catch(function(error) {
				console.error(error);	//*** to-do: better error handling ***
			});
		});
		
		//don't allow default browser behavior of immediately loading the file
		function preventDefault(e) {
			e.preventDefault();
			  e.stopPropagation();
		}
		dropRegion.addEventListener('dragenter', preventDefault, false);
		dropRegion.addEventListener('dragleave', preventDefault, false);
		dropRegion.addEventListener('dragover', preventDefault, false);
		dropRegion.addEventListener('drop', preventDefault, false);
	
		//handle drag and drop
		function handleDrop(e) {
			var data = e.dataTransfer;
			var file = data.files[0];
			elan.loadEAF(file)
			.then(function() {
				onLoadEAF();
			})
			.catch(function(error) {
				console.error(error);	//*** to-do: better error handling ***
			});
		}
		dropRegion.addEventListener('drop', handleDrop, false);
	}
	
	
	//
	// ELAN FILE PROCESSES
	//
	async function onLoadEAF() {
		document.getElementById("user-input").style.display = "none";
		document.getElementById("info").style.display = "none";
		document.getElementById("results").style.display = "block";
		
		//load material from tiers into window
		document.getElementById("progress-text").innerHTML = "Converting ELAN to JS Array . . ." + document.getElementById("progress-text").innerHTML;
		var tiers, annotations, download_name;
		
		var elan_export = elan.exportForViewer();
		tiers = elan_export[0];
		annotations = elan_export[1];
		download_name = elan_export[2];
		if (download_name.substring(download_name.length - 4) == ".eaf")
				download_name = download_name.substring(0,download_name.length - 4);
		
		var tier_text = "const tiers = " + JSON.stringify(tiers,null,'\t') + ";\r\n";
		var annotations_text = "const annotations = " + JSON.stringify(annotations,null,'\t') + ";";
		
		document.getElementById("js-output").innerHTML = tier_text + annotations_text;
		document.getElementById("progress-text").innerHTML += " Done";
		
		//enable button
		document.getElementById("js-download").addEventListener('click', function(){	
			var blob = new Blob([tier_text + annotations_text], {type: 'text/javascript;charset=utf-8;'});
			var url = URL.createObjectURL(blob);
			var download_link = document.createElement('a');
			download_link.href = url;
			download_link.setAttribute('download', download_name + ".js");
			download_link.click();
		});
		document.getElementById("js-download").disabled = false;
		
		//produce blocks
		loadTranscriptions(tiers, annotations)
			.then(function(){
				//enable button
				document.getElementById("transcript-download").addEventListener('click', function(){
					var blob = new Blob([document.getElementById("transcript").innerHTML], {type: 'text/javascript;charset=utf-8;'});
					var url = URL.createObjectURL(blob);
					var download_link = document.createElement('a');
					download_link.href = url;
					download_link.setAttribute('download', download_name + ".html");
					download_link.click();
				});
				document.getElementById("transcript-download").disabled = false;
			});
	}
	
	
	
	//
	// loadTranscriptions(Object, Object)
	//
	// Takes an array of Tier objects and lays out the tiers, tier names, and content blocks
	//
	// This function can take a LONG time for longer transcripts (even 15 min)
	// So uses an async and await to add small pauses, allowing the browser to refresh
	// This lets the already prepared transcriptions start filling the transcription
	//
	async function loadTranscriptions(tiers, annotations) {
		
		document.getElementById("loading").style.display = "inline";
		
		//where to put the blocks
		//put here temporarily so we can re-order them before displaying
		const transcript = document.getElementById("transcript");
		transcript.innerHTML = "";
		
		//for displaying updates
		const progress_text = document.getElementById("progress-text");
		progress_text.innerHTML = "Parsing top-level tiers. . .<br />" + progress_text.innerHTML;
		
		//get ordered tiers -- (x in Object) does not preserve order
		htiers = Object.keys(tiers);	//tiers are pre-sorted into a hierarchy when exported
		
		// Top-Level Tiers first
		// we'll collect all the annotations on relevant tiers and then sort by time & display
		// go through all tiers
		for (var r in htiers) {
			t = htiers[r];
			//get top-level tiers
			if ( tiers[t].parent_tier === null ) {
				//get the annotations
				var tier_annotations = annotations[t];
				for (var i = 0; i < tier_annotations.length; i++) {
					var a = tier_annotations[i];
					
					//create elements and arrange
					const new_line = document.createElement("div");
					const new_time = document.createElement("div");
					var new_t = document.createElement("div");
					
					new_line.classList.add("transcription-line");
					new_line.id = "line-" + a[0];	//each annotation has its own ID
					new_line.setAttribute("data_start", a[2][0]);
					new_line.setAttribute("data_end", a[2][1]);
					
					new_time.classList.add("transcription-time");
					new_time.innerHTML = msToMinSec(a[2][0]);
					
					new_t.id = a[0];
					new_t.classList.add("transcription-block");
					new_t.classList.add(tiers[t].type);
					new_t.innerHTML = a[3].replaceAll("<","&#60;").replaceAll(">","&#62");
					
					//add stack to keep child elements aligned
					var new_stack = document.createElement("div");
					new_stack.classList.add("transcription-stack");
					new_stack.id = "st-" + a[0];	//each annotation has its own ID
					new_stack.appendChild(new_t);
					
					//build line
					new_line.appendChild(new_time);
					new_line.appendChild(new_stack);
					transcript.appendChild(new_line);
					//pause a moment to refresh so page appears active
					await timer(1);
				}
			}
		}

		progress_text.innerHTML = "Re-Ordering top-level tiers. . .<br />" + progress_text.innerHTML;
		//order the divs by custom "data_start" attribute
		var lines = [...document.getElementsByClassName("transcription-line")];
		lines.sort((a,b) => (+a.getAttribute("data_start") - +b.getAttribute("data_start")) );
		document.getElementById("transcript").innerHTML = "";
		for (var i=0; i < lines.length; i++) {
			document.getElementById("transcript").appendChild(lines[i]);
			// eval('document.getElementById("' + lines[i].id + '").addEventListener("click", () => {'
				// + 'audio.currentTime = (' + lines[i].getAttribute("data_start") + ')/1000;'
				// + 'audio.play();'
				// + '});');
		}

		
		progress_text.innerHTML = "Parsing sub-tiers. . .<br />"  + progress_text.innerHTML;
		//Sub-Tiers next
		//go through all tiers
		for (var i in htiers) {
			progress_text.innerHTML = "Tier " + i + " of " + htiers.length + "<br />" + progress_text.innerHTML;
			var t = htiers[i];
			//get lower-level tiers
			if ( tiers[t].parent_tier !== null  ) {
				//get the annotations of that tier
				a = annotations[t];
				for (var i = 0; i < a.length; i++) {
					//create elements and arrange
					var parent_id = a[i][1];
					var par_div = document.getElementById(parent_id);
					
					var new_t = document.createElement("div");
					new_t.innerHTML = a[i][3].replaceAll("<","&#60;").replaceAll(">","&#62");
					if (tiers[t].type == "Morphemes") new_t.innerHTML = "<a href='" + new_t.innerHTML + "'>" + new_t.innerHTML + "</a>";	//HACKY, MAKE MORE ROBUST LATER
					new_t.classList.add("transcription-block");
					new_t.classList.add(tiers[t].type);
					new_t.id = a[i][0];		//each annotation has its own ID
					
					if (tiers[t].constraints == "Symbolic_Association") {	//1-to-1
						if (par_div.getAttribute("class").includes("transcription-block"))
							par_div.parentElement.appendChild(new_t);
						else
							par_div.appendChild(new_t);
						
					} else {
						var siblings = getSiblings(annotations, t, a[i]);	//(siblings includes self)
						if (siblings.length == 1) { 	//1-to-1 
							if (par_div.getAttribute("class").includes("transcription-block"))
								par_div.parentElement.appendChild(new_t);
							else
								par_div.appendChild(new_t);
							
						} else { //has siblings (length > 1)
							//add stack to keep child elements aligned
							var new_stack = document.createElement("div");
							if (! par_div.parentElement.getAttribute("class").includes("time-aligned-stack")) {
								new_stack.classList.add("time-aligned-stack");
								new_stack.id = "st-" + a[i][0];	//each annotation has its own ID
								new_stack.appendChild(new_t);
								
							} else {	//"class" == "time-aligned-stack"
								if (par_div.parentNode.childNodes.length == 1) {	//no other annotations yet (childNodes includes parent??)
									new_stack.classList.add("time-aligned-substack");
									new_stack.id = "sub-" + par_div.id;
									
									const sub_stack = document.createElement("div");
									sub_stack.classList.add("time-aligned-stack");
									sub_stack.id = "st-" + a[i][0];	//each annotation has its own ID
									sub_stack.appendChild(new_t);
									new_stack.appendChild(sub_stack);
								} else {	//other annotations of parent
									const sub_stack = document.getElementById("sub-" + par_div.id);
									new_stack.classList.add("time-aligned-stack");
									new_stack.id = "st-" + a[i][0];	//each annotation has its own ID
									new_stack.appendChild(new_t);
									sub_stack.appendChild(new_stack);
									new_stack = sub_stack;
								}
							}
							
							par_div.parentElement.appendChild(new_stack);
						}
					}
					
					//pause a moment to refresh so page appears active
					await timer(1);
				}
			}
		}
		
		document.getElementById("loading").style.display = "none";
		progress_text.innerHTML = "Done<br />" + progress_text.innerHTML;
		document.getElementById("transcript-download").disabled = false;
	}
	
	
	
	// 
	// timer(Numeric)
	//
	// Returns a Promise that resolves after "ms" Milliseconds
	//
	function timer(ms) {
		return new Promise(res => setTimeout(res, ms));
	}


	//
	// hasChildOfType(String, String)
	//
	// Returns a Boolean whether any children down the hierarchy are of the given type
	//
	function hasChildOfType(tier_name, type) {
		var child_tiers = getChildTiers(tier_name);
		var children_of_type = false;
		
		if (child_tiers.length == 0) {	//no children, return false
			return false;
		}
		for (var t in tiers) {
			for (var i = 0; i < child_tiers.length; i++) {
				if (t == child_tiers[i]  &&  tiers[t].type == type) {	//at least one matching child
					return true;
				}
			}
		}
		for (var i = 0; i < child_tiers.length; i++) {
			if(hasChildOfType(child_tiers[i], type)) {	//check further descendants
				children_of_type = true;
			}
		}
		return children_of_type;
	}
	
	
	//
	// getChildTiers(String)
	//
	// Returns an array of Strings (tier-id) having the current Tier as a parent
	//
	function getChildTiers(tier_id) {
		var child_tiers = [];
		
		for (var t in tiers) {
			if (tiers[t].parent_tier !== null
				&& tiers[t].parent_tier == tier_id) { //get the tier if it has this one as its parent
				child_tiers.push(t);
			}
		}
		return child_tiers;
	}
	
	
	//
	// getSiblings(String, Array)
	//
	// Returns an array of annotation-ids for siblings to the current annotation
	//
	function getSiblings(annotations, tier_id, annotation_data) {		
		var siblings = [];
		
		var a = annotations[tier_id];
		for (var i = 0; i < a.length; i++) {
			if (a[i][1] == annotation_data[1])
				siblings.push(a[i][0]);
		}
		return siblings;
	}
	
	//
	// msToMinSec(int)
	//
	// Converts milliseconds to Minute:Second (mm:ss) display times
	// taken from: https://stackoverflow.com/questions/21294302/converting-milliseconds-to-minutes-and-seconds-with-javascript
	//
	function msToMinSec(ms) {
		var minutes = Math.floor(ms / 60000);
		var seconds = ((ms % 60000) / 1000).toFixed(0);
		return (seconds == 60 ? (minutes+1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
	}	
}
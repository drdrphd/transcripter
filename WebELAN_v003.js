/*!
 * WebELAN
 * Version: 0.0.3
 * Author: dr²
 * AI coding assistant: ChatGPT
 * License: fully open, no rights reserved, use at your own risk
 * Description: A library of functions for handling ELAN files within a browser
 * 				ELAN is a time-aligned transcription platform for linguistic transcription
 *				Much hard work has been put into it by the people at the Max Planck Institute
 *				https://archive.mpi.nl/tla/elan
 *				WebELAN is unrelated to & independent from their efforts
 */


/****************/
/* Constructors */
/****************/

function WebELAN() {
	this.elan_file = {};	//will contain the parsed XML
	this.filename = "";
	this.times = {};		//will hold an object of times, interpolating values for blank times
	this.tiers = {};		//will hold a hierarchically sorted object of tiers
}



/****************************************/
/* Functions for creating and exporting */
/****************************************/


//
// loadEAF(file)
//
// Takes an .eaf file from the browser (file)
// Parses the XML, stores it internally, and returns a (Promise)
//
WebELAN.prototype.loadEAF = function(file) {
	var self = this;  //to use in the Promise scope below
	return new Promise(function(resolve, reject) {
		var reader = new FileReader();
		var parser = new DOMParser();
		reader.onload = function(e) {
			var xml_doc = e.target.result;
			self.elan_file = parser.parseFromString(xml_doc, "text/xml");
			resolve(); // ***success feedback here***
			//reject(); // ***error codes***
		};
		reader.readAsText(file);
		self.filename = file.name;
	}).then(() => {
		self.setupTimes();
		self.setupTiers();
	});
}


//
// exportEAF()
//
// Export an ELAN XML to .eaf
// Creates a blob, initiates download of the blob
//
WebELAN.prototype.exportEAF = function(filename) {
	
	if (filename === undefined) {
		if (this.filename.substring(this.filename.length-4, this.filename.length) == ".eaf") { //if filename ends in .eaf ...
			filename = (this.filename.substring(0, this.filename.length-4) + " (copy)" + ".eaf"); //insert " (copy)" into the filename before the extension (no overwriting, please)
		} else {
			filename = this.filename + " (copy)" + ".eaf"; //add " (copy)" to the filename (no overwriting, please) and add .eaf extension
		}
	}
	
	var xmlString = new XMLSerializer().serializeToString(this.elan_file);
	var blob = new Blob([xmlString], {type: 'application/xml;charset=utf-8;'});
	var url = URL.createObjectURL(blob);
	var download_link = document.createElement('a');
	download_link.href = url;
	download_link.setAttribute('download', filename);
	download_link.click();
}



//
// exportForViewer()
//
// Exports Tiers & Annotations to JS Arrays
// const annotations =
// [
//	 ["Tier name", [
//					  ["annotation id", [start_time, end_time], value],
//			OR		  ["annotation id", "parent annotation id", value],
//						...
//					]],
//   ["Tier name", [ ... ]],
//	 ...
// ]
// Creates a blob, initiates download of the blob
//
WebELAN.prototype.exportForViewer = function() {
	var all_tiers = {};
	for (var i = 0; i < this.tiers.length; i++) {
		tier_obj = {};
		var tier = this.tiers[i];
		var id = tier.getAttribute("TIER_ID");
		
		tier_obj.type = tier.getAttribute("LINGUISTIC_TYPE_REF");
		tier_obj.parent_tier = tier.getAttribute("PARENT_REF");
		tier_obj.constraints = this.tierConstraints(tier);
		tier_obj.time_alignable = this.tierAlignable(tier);
		
		all_tiers[id] = tier_obj;
	}
	
	var all_annotations = {};
	for (var i = 0; i < this.tiers.length; i++) {
		var tier = this.tiers[i];
		var tier_annotations = [];
		var annotations = this.annotations(tier);
		for (var j = 0; j < annotations.length; j++) {
			var annotation_values = [];
			var a = annotations[j];
			var p = this.getParentRef(a);
			var t = this.getExportTimes(a);
			
			annotation_values.push(this.getId(a));
			annotation_values.push(p);
			annotation_values.push(t);
			annotation_values.push(this.value(a));
			
			tier_annotations.push(annotation_values);
		}
		
		all_annotations[tier.getAttribute("TIER_ID")] = tier_annotations;
	}


	return [all_tiers, all_annotations, this.filename];
}




/*******************************************/
/* Functions for setting up initial values */
/*******************************************/


//
// setupTimes()
//
// Retrieves the list of TIME_SLOT elements,
//	extracts the TIME_SLOT_ID as an object key,
//	adds the TIME_VALUE as the value, or
//	interpolates surrounding times for blank values
//
// Stores the result in this.times {}
//
WebELAN.prototype.setupTimes = function() {
	var times = this.elan_file.getElementsByTagName("TIME_SLOT");
	for (var i = 0; i < times.length; i++) {
		var val = times[i].getAttribute("TIME_VALUE");
		
		//some TIME_SLOT values are undefined (annotations are siblings and take up equal space)
		//for those, get the first prior time slot that has a value
		//and the first later slot that has a value, and assign an interpolated value
		if (val === null) {
			//number of null slots in a row = back + forward
			var back = 0;
			var forward = 0;
			var start = val;
			var end = val;
		
			while (start === null) {
				back++;
				start = times[i - back].getAttribute("TIME_VALUE");
			}
			while (end === null) {
				forward++;
				end = times[i + forward].getAttribute("TIME_VALUE");
			}
			
			val = +start + back * Math.floor((end - start) / (back + forward));
			val = "" + val;
		}
		
		this.times[times[i].getAttribute("TIME_SLOT_ID")] = val;
	}
}


//
// setupTiers()
//
// Retrieves the list of TIER XML elements,
//	and sorts hierarchically
//
// Stores the result in this.times {}
//
WebELAN.prototype.setupTiers = function() {
	var tiers = this.elan_file.getElementsByTagName("TIER"); //if none, then null
	this.tiers = this.sortTiersHierarchical(tiers);
}




/***************************************/
/* Functions for retrieving properties */
/***************************************/


//
// annotations(), annotations(tierXML)
//
// Returns an XML object of TIME_SLOT elements {XML, XML, ...}
//
WebELAN.prototype.annotations = function(tierXML) {
	if (tierXML !== undefined) {	//if passed a value...
		return tierXML.getElementsByTagName("ANNOTATION"); //if none, then null
	} else {	//otherwise, get all annotations
		return this.elan_file.getElementsByTagName("ANNOTATION"); //if none, then null
	}
};

//
// value()
//
// Returns the inner text of an Annotation XML object
//
WebELAN.prototype.value = function(annotation) {
	return annotation.firstElementChild.firstElementChild.textContent;
};


//
// getId(...)
// 
// Returns the text of any attribute that ands in "_ID"
WebELAN.prototype.getId = function(item) {
	//annotations store their properties in their child tags
	if	(item.tagName !== null && item.tagName == "ANNOTATION")
		item = item.firstElementChild;
	
	var attribute_array = item.getAttributeNames();
	
	for (var i = 0; i < attribute_array.length; i++) {
		if ("_ID" == attribute_array[i].substring(attribute_array[i].length-3, attribute_array[i].length)) {
			return item.getAttribute(attribute_array[i]);
		}
	}		
};


//
// getTSTime(string)
//
// Takes a TIME_SLOT_ID (string)
// Returns a time (numeric) in miliseconds or null if no value
//
WebELAN.prototype.getTSTime = function(time_slot) {
	var time = this.times[time_slot];
	if (time === undefined)
		return null;
	else
		return +time;
};


//
// getMaxTime()
//
// Finds the maximum time among all TIME_SLOT elements
// Returns a time (numeric) in miliseconds
//
WebELAN.prototype.getMaxTime = function() {
	times = this.times();
	max_time = 0;
	for (var i = 0; i < times.length; i++) {
		if (max_time < +times[i].getAttribute("TIME_VALUE")) {	// use + to cast text values as numeric
			max_time = +times[i].getAttribute("TIME_VALUE");
		}
	}
	return max_time;
};



/***************************************/
/* Functions for properties of objects */
/***************************************/


//
// tierType(tierXML)
//
// Returns a string with the tier's LINGUISTIC_TYPE_REF
//
WebELAN.prototype.tierType = function(tier) {
	return tier.getAttribute("LINGUISTIC_TYPE_REF");
};


//
// tierConstraints(tierXML)
//
// Returns a string with the tier's associated LINGUISTIC_TYPE CONSTRAINTS
//
WebELAN.prototype.tierConstraints = function(tier) {
	const type = tier.getAttribute("LINGUISTIC_TYPE_REF");
	const linguistic_types = this.elan_file.getElementsByTagName("LINGUISTIC_TYPE");
	for (var i = 0; i < linguistic_types.length; i++) {
		if (linguistic_types[i].getAttribute("LINGUISTIC_TYPE_ID") == type)
			return linguistic_types[i].getAttribute("CONSTRAINTS");	//null if no CONSTRAINTS
		
	}
	//if we get through without matching type, then there was an error in the ELAN file
	console.error("No matching LINGUISTIC_TYPE tag for Tier: " + this.getId(tier));
};


//
// tierAlignable(tierXML)
//
// Returns a string with the tier's associated LINGUISTIC_TYPE CONSTRAINTS
//
WebELAN.prototype.tierAlignable = function(tier) {
	const type = tier.getAttribute("LINGUISTIC_TYPE_REF");
	const linguistic_types = this.elan_file.getElementsByTagName("LINGUISTIC_TYPE");
	for (var i = 0; i < linguistic_types.length; i++) {
		if (linguistic_types[i].getAttribute("LINGUISTIC_TYPE_ID") == type)
			return linguistic_types[i].getAttribute("TIME_ALIGNABLE");	//null if no property
		
	}
	//if we get through without matching type, then there was an error in the ELAN file
	console.error("No matching LINGUISTIC_TYPE tag for Tier: " + this.getId(tier));
};


//
// subdividingTier(tierXML)
//
// Returns a boolean if the tier has a subdividing type:
// Associated Type of "Symbolic_Subdivision" or "Time_Subdivision"
//
WebELAN.prototype.subdividingTier = function(tier) {
	if (this.tierConstraints(tier) == "Symbolic_Subdivision"
	 || this.tierConstraints(tier) == "Time_Subdivision")
		return true;
	return false;
};


//
// topLevelTier(tierXML)
//
// Returns a boolean value
// is the tier a top-level tier? (has no parents)
//
WebELAN.prototype.topLevelTier = function(tier) {
	return !tier.hasAttribute("PARENT_REF");
};


//
// getParentRef(annotationXML)
//
// Returns a String, reference to the annotation's parent
//
WebELAN.prototype.getParentRef = function(annotation) {
	var ref = annotation.firstElementChild.getAttribute("ANNOTATION_REF"); //parent Annotation
	//time alignable annotations do not list a parent
	if (ref !== null)
		return ref;
	
	// otherwise, we have to get the parent tier reference,
	// then get that tier's parent's annotations
	// go through each annotation and see if the annotations start and end times surround the query annotation
	else {
		var grandparent_tier = annotation.parentNode.getAttribute("PARENT_REF");
		if (grandparent_tier !== null) {
			const a_times = this.getTimes(annotation);
			const annotations = this.annotations(this.getTierById(grandparent_tier));
			for (var i = 0; i < annotations.length; i++) {
				const b_times = this.getTimes(annotations[i]);
				if (b_times[0] <= a_times[0] && b_times[1] >= a_times[1])
					return annotations[i].firstElementChild.getAttribute("ANNOTATION_ID"); //parent Annotation;
			}
		//top-level tiers will not have parents
		} else {
			return null;
		}
	}
};


//
// getSiblingRefs(annotationXML)
//
// Returns an array of references to annotations [string,...]
// that have the same parent Annotation as the current Annotation
// (includes self)
//
WebELAN.prototype.getSiblingRefs = function(annotation) {
	
	//use XML file to prevent a recursive call
	const annotationElements = this.elan_file.getElementsByTagName("ANNOTATION");
	const parentRef = (annotation.firstElementChild.getAttribute("ANNOTATION_REF") || null); //top-tier annotations have no parent
	var siblings = [];
	
	for (var i = 0; i < annotationElements.length; i++) {
		if (parentRef !== null	//don't get elements without a parent
		 && parentRef == annotationElements[i].firstElementChild.getAttribute("ANNOTATION_REF")) {
			siblings.push(annotationElements[i].firstElementChild.getAttribute("ANNOTATION_ID"));
		}
	}
	return siblings;
};
	

//
// getChildTiers(tierXML)
//
// Returns an array of XML TIER elements [XML, XML, ...] having the current Tier as a parent
//
WebELAN.prototype.getChildTiers = function(tier) {
	var child_tiers = [];
	var tier_id = this.getId(tier);
	
	for (var i = 0; i < this.tiers.length; i++) {
		if (this.tiers[i].getAttribute("PARENT_REF") == tier_id) { //get the tier if it has this one as its parent
			child_tiers.push(this.tiers[i]);
		}
	}
	return child_tiers;
};


//
// hasChildOfType(tierXML, String)
//
// Returns an Boolean whether any children down the hierarchy are of the given type
//
WebELAN.prototype.hasChildOfType = function(tier, type) {
	var child_tiers = this.getChildTiers(tier);
	var children_of_type = false;
	
	if (child_tiers.length == 0) {	//no children, return false
		return false;
	}
	for (var i = 0; i < child_tiers.length; i++) {
		if (child_tiers[i].getAttribute("LINGUISTIC_TYPE_REF") == type) {	//at least one matching child
			return true;
		}
	}
	for (var i = 0; i < child_tiers.length; i++) {
		if(this.hasChildOfType(child_tiers[i], type)) {	//check further descendants
			children_of_type = true;
		}
	}
	return children_of_type;
};


//
// getTimes(annotationXML)
//
// Takes an Annotation XML object
// Return an array of Start time and End time, [num, num]
//
WebELAN.prototype.getTimes = function(annotation) {
	var time = "";
		
	//for alignable annotations
	if ("ALIGNABLE_ANNOTATION" == annotation.children[0].tagName) {
		var start_time_ref = annotation.firstElementChild.getAttribute("TIME_SLOT_REF1");
		var end_time_ref = annotation.firstElementChild.getAttribute("TIME_SLOT_REF2");
		var start = this.getTSTime(start_time_ref);
		var end = this.getTSTime(end_time_ref);
		
		//some TIME_SLOT values are undefined (annotations are siblings and take up equal space)
		//for those, get the first prior time slot that has a value
		//and likewise, if end time is undefined, get first later slot that has a value
		while (start === null) {
			start_time_ref = "ts" + (+start_time_ref.substring(2) - 1);
			start = this.getTSTime(start_time_ref);
		}
		while (this.getTSTime(end_time_ref) === null) {
			end_time_ref = "ts" + (+end_time_ref.substring(2) + 1);
			end = this.getTSTime(end_time_ref);
		}
		return [this.getTSTime(start_time_ref), this.getTSTime(end_time_ref)];
	}
	
	//for reference annotations...
	//get the times of the parent and the number of siblings
	//divide the parent time by siblings...
	//figure out the order of the siblings...
	//and assign a sub-time to this annotation
	// *** possible future re-write if there's an easier way ***
	//
	const parent_ref = annotation.firstElementChild.getAttribute("ANNOTATION_REF");
	const siblings = this.getSiblingRefs(annotation);
	const parent_times = this.getTimes(	//recursive call for the...
		this.getAnnotationById( parent_ref ) );  //..parent annotation
		
	if (siblings.length == 1) {  //(includes self)
		return parent_times;
	} else {
		var sub_duration = (parent_times[1] - parent_times[0]) / siblings.length;
		var ordered_siblings = [];
		//look for siblings without times
		for (var i = 0; i < siblings.length; i++) {
			if ( this.getAnnotationById(siblings[i]) //retrieve referenced sibling
					.firstElementChild.getAttribute("PREVIOUS_ANNOTATION") //check for sub-tag with "PREVIOUS_ANNOTATION"
					   === null ) {  //null if is at left
				ordered_siblings.push(siblings[i]);
			}
		}
		//then add siblings who are to the right of the prior annotation
		//we have to go through the list once for each element we add
		for (var i = 0; i < siblings.length; i++) {
			for (var j = 0; j < ordered_siblings.length; j++) {
				if ( this.getAnnotationById(siblings[i]) //retrieve referenced sibling
						.firstElementChild.getAttribute("PREVIOUS_ANNOTATION") //check for sub-tag with "PREVIOUS_ANNOTATION"
							== ordered_siblings[ordered_siblings.length - 1] ) { //check against last item
					ordered_siblings.push(siblings[i]);
				}
			}
		}
		var ord = 0;
		for (var i = 0; i < ordered_siblings.length; i++) {
			if (ordered_siblings[i] == this.getId(annotation))
				ord = i;
		}
		const start_time = parent_times[0] + Math.floor(ord * sub_duration);
		const end_time = parent_times[0] + Math.floor((ord + 1) * sub_duration);
		
		return [start_time, end_time];
	}
};

//
// getExportTimes(annotationXML)
//
// Takes an Annotation XML object
// Return an array of Start time and End time, [num, num]
//
WebELAN.prototype.getExportTimes = function(annotation) {
	var time = "";
		
	//for alignable annotations
	if ("ALIGNABLE_ANNOTATION" == annotation.children[0].tagName) {
		var start_time_ref = annotation.firstElementChild.getAttribute("TIME_SLOT_REF1");
		var end_time_ref = annotation.firstElementChild.getAttribute("TIME_SLOT_REF2");
		var start = this.getTSTime(start_time_ref);
		var end = this.getTSTime(end_time_ref);
		
		//some TIME_SLOT values are undefined (annotations are siblings and take up equal space)
		//for those, get the first prior time slot that has a value
		//and likewise, if end time is undefined, get first later slot that has a value
		while (start === null) {
			start_time_ref = "ts" + (+start_time_ref.substring(2) - 1);
			start = this.getTSTime(start_time_ref);
		}
		while (this.getTSTime(end_time_ref) === null) {
			end_time_ref = "ts" + (+end_time_ref.substring(2) + 1);
			end = this.getTSTime(end_time_ref);
		}
		return [this.getTSTime(start_time_ref), this.getTSTime(end_time_ref)];
	}
	
	//for reference annotations...
	//return empty times
	//
	return [];
};


//
// getTierById(string)
//
// Takes a reference to an Tier (string)
// Returns an Tier XML Object
//
WebELAN.prototype.getTierById = function(ref) {
	for (var i = 0; i < this.tiers.length; i++) {
		if (ref == this.getId(this.tiers[i])) {
			return this.tiers[i];
		}
	}
};


//
// getAnnotationById(string)
//
// Takes a reference to an Annotation (string)
// Returns an Annotation XML Object
//
WebELAN.prototype.getAnnotationById = function(ref) {
	annotationElements = this.elan_file.getElementsByTagName("ANNOTATION");	//if none, then null
	for (var i = 0; i < annotationElements.length; i++) {
		if (ref == annotationElements[i].children[0].getAttribute("ANNOTATION_ID")) {
			return annotationElements[i];
		}
	}
};





/***********************************/
/* Functions for modifying content */
/***********************************/

//
// sortTiersHierarchical([tierXML])
//
// Takes an array of Tier objects
// First separates into parents and non-parents
// (Puts all parents into the sorted_array)
// Then while there are children,
// goes through and inserts after its parent in the sorted array
//
// Returns an array of Tier objects
//
WebELAN.prototype.sortTiersHierarchical = function(tiers) {
	var sorted_array = [];
	var children = [];
	
	//separate off the top nodes
	for (var i = 0; i < tiers.length; i++) {
		if (tiers[i].getAttribute("PARENT_REF") === null) {
			sorted_array.push(tiers[i]);
		} else {
			children.push(tiers[i]);
		}
	}
	
	const getParentIndex = (id) => {
		for (var i = 0; i < sorted_array.length; i++) {
			if (this.getId(sorted_array[i]) == id) return i;
		}
		return null;
	};
	
	var q = 100; //while loop max, in case elan file has an error
	while (children.length > 0 && q > 0) {	//keep doing this while there are children
		var temp_tier = children.pop();	//take the last element
		var i = getParentIndex(temp_tier.getAttribute("PARENT_REF")); //get the index of the parent tier in sorted_array (returns null if not in list)
		if (i !== null) {
			sorted_array.splice(i+1, 0, temp_tier); //insert after its parent
		} else {
			children.unshift(temp_tier);  //or, if no parent in the list, put it back at the beginning of children and try again
		}
		q--;
	}
	if (q == 0 ) error.log("Cannot sort tiers hierarchically, possible file error");
	return sorted_array;
};





/*********************/
/* General Utilities */
/*********************/

//
// msToMinSec(int)
//
// Converts milliseconds to Minute:Second (mm:ss) display times
// taken from: https://stackoverflow.com/questions/21294302/converting-milliseconds-to-minutes-and-seconds-with-javascript
//
WebELAN.prototype.msToMinSec = function(ms) {
	var minutes = Math.floor(ms / 60000);
	var seconds = ((ms % 60000) / 1000).toFixed(0);
	return (seconds == 60 ? (minutes+1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
};
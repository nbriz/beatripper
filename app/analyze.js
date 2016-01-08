var nw			= require('nw.gui');
var win 		= nw.Window.get();
var jsonfile	= require('jsonfile');
var util	 	= require('util');
var path 		= require('path');

var dbpath 		= 'data/data.json';
var data;		// entire json data base
var obj;		// this particular entry

BB.Audio.init();
var tracks 		= [];
var doDefault	= false;
var hazNfo 		= true;
// load up data
jsonfile.readFile(dbpath, function(err, json) {
 	data = json;
 	backup( data );
});

function backup( db ){ 	// back up data ( b/c i'm paranoid )
	jsonfile.writeFile('data/data-backup.json', db, {spaces: 0}, function(err) {
		console.error(err);
	});	
}

document.onkeypress = function(e){
	var e = window.event || e;
	if(e.keyCode == 17) win.close(); // cntrl + Q
	if(e.keyCode == 6 ) (win.isKioskMode) ? nw.Window.get().leaveKioskMode() : nw.Window.get().enterKioskMode(); // cntrl + F
	if(e.keyCode == 7) (document.body.style.cursor=="") ? document.body.style.cursor = "none" : document.body.style.cursor = ""; // cntrl + G
}

function defaults( obj, f, q, g, t ){
	var config = obj;
	config.frequency = (typeof config.frequency==="undefined") ? f : config.frequency;
	config.Q = (typeof config.Q==="undefined") ? q : config.Q;
	config.gain = (typeof config.gain==="undefined") ? g : config.gain;
	config.threshold = (typeof config.threshold==="undefined") ? t : config.threshold;
	return config;
}

function addTrack( path, config, callback ){
	if( hazNfo ){ document.body.removeChild( nfo ); hazNfo=false };

	if(typeof obj == "undefined"){
		choose.click();
		obj = {}
	} else {

		var filter;

		if(typeof config === "undefined"){ 
			var filt = prompt('choose a type of filter','lowpass');
			var types = ["lowpass", "highpass", "bandpass", "lowshelf", "highshelf", "peaking", "notch", "allpass"];
			if( types.indexOf(filt) < 0 ){
				alert('invalid filter type, msust be lowpass, highpass, bandpass, lowshelf, highshelf, peaking, notch or allpass');
				return;
			}
			config = {}; 
			filter = filt;
		
		} else {
			filter = (typeof config.filter === "undefined") ? "lowpass" : config.filter;
		}

		if(filter=="lowpass") config = defaults(config, 74,11,0,0.66 );
		if(filter=="bandpass") config = defaults(config, 220,13.7,0,0.129 );
		if(filter=="highpass") config = defaults(config, 8457,30,0,0.02 );

		var newtrack;
		if(typeof callback === "undefined"){
			newtrack = new BeatRipper({
				path: 		path,
				filter: 	filter,
				gui: 		true,
				frequency: 	config.frequency,
				Q: 			config.Q,
				gain: 		config.gain,
				threshold: 	config.threshold
			});	
		} else {
			newtrack = new BeatRipper({
				path: 		path,
				filter: 	filter,
				gui: 		true,
				frequency: 	config.frequency,
				Q: 			config.Q,
				gain: 		config.gain,
				threshold: 	config.threshold
			},function(o){ callback(o) });	
		}

		tracks.push( newtrack );
	}
}

function execDefault(){
	doDefault = true;
	choose.click();
	obj = {};
	// update gui
	nav.removeChild( add_track );
	nav.removeChild( default_analyze );
}

function addDefaults( path ){

	var total = 3;
	var count = 0;

	var wait = document.createElement('div');
		wait.className = "wrap";
	document.body.appendChild(wait);

	// kick
	addTrack( path,{
		filter: "lowpass",
		frequency: 74,
		Q: 11,
		threshold: 0.66
	}, function(o){
		count++;
		if(count==total) document.body.removeChild(wait);
	});
	// snare
	addTrack( path,{
		filter: "bandpass",
		frequency: 220,//4122,
		Q: 13.7,//5,
		threshold: 0.129//0.088
	},function(o){
		count++;
		if(count==total) document.body.removeChild(wait);
	});
	// hat
	addTrack( path,{
		filter: "highpass",
		frequency: 8457,
		Q: 30,
		threshold: 0.02
	},function(o){
		count++;
		if(count==total) document.body.removeChild(wait);
	});
}

function save(){
	
	if(typeof obj === "undefined"){
		alert('you must first create a track[s]');
		return;
	}

	for (var i = 0; i < tracks.length; i++) {
		if(tracks[i].tempo === -1){
			alert('Error: one of your tracks hasn\'t been analyzed, click [ update visualizations ]');
			return;
		}
	};

	// meata data ---------------------------
	var filepath = path.parse( choose.value );
	obj.title = filepath.name;
	obj.filename = filepath.base;
	obj.location = filepath.dir;
	obj.length = tracks[0].buffer.duration;
	obj.tempo = (function(){
		var counts = {};
		for (var i = 0; i < tracks.length; i++) {
			var tempo = tracks[i].tempo;
			if(typeof counts[tempo] === "undefined" ) counts[tempo] = 1;
			else counts[tempo]++;
		};
		var win = { bpm:0,count:0 };
		for(key in counts){
			if( counts[key] > win.count ){
				win.bpm = key;
				win.count = counts[key];
			}
		}
		return parseInt(win.bpm);
	}());
	
	// rip scripts from each track -----------
	obj.scripts = [];
	for (var i = 0; i < tracks.length; i++) {
		obj.scripts.push( tracks[i].rip() );
	};

	// insert into data.json -----------------
	var dupblicate = false;
	var index;
	
	for (var i = 0; i < data.rythms.length; i++) {
		if( data.rythms[i].title == obj.title ){
			dupblicate = true;
			index = i;
			break;
		}
	};

	if(!dupblicate){

		data.rythms.push( obj ); // ADD
		jsonfile.writeFile(dbpath, data, {spaces: 0}, function(err) {
	  		console.error(err);
		});		
		window.location = 'player.html?index='+(data.rythms.length-1);

	} else {

		var replace = confirm(obj.title+" is already in the db,\n do u want to replace it?");
		if(replace){
			data.rythms[index] = obj; // REPLACE
			jsonfile.writeFile(dbpath, data, {spaces: 0}, function(err) {
		  		console.error(err);
			});
			window.location = 'player.html?index='+index;
		} 
	}
}




// ---------------------------- GUI -------------------------------
// ---------------------------- GUI -------------------------------
// ---------------------------- GUI -------------------------------

var nav = document.createElement('div');
	nav.className = "nav";
	nav.innerHTML = "BeatR¡pper";
	nav.style.width = innerWidth - (72) +"px";// border + margin
document.body.appendChild(nav);

var choose = document.createElement('input');
	choose.setAttribute('type','file');
	choose.onchange = function(){
		if(doDefault)
			addDefaults( choose.value );
		else
			addTrack( choose.value );
	}

var default_analyze = document.createElement('button');
	default_analyze.innerHTML = "auto-analyze";
	default_analyze.className = "btn";
	default_analyze.style.position = "absolute";
	default_analyze.onclick = function(){
		execDefault();
	}
nav.appendChild(default_analyze);

var add_track = document.createElement('button');
	add_track.innerHTML = "custom track";
	add_track.className = "btn";
	add_track.style.position = "absolute";
	add_track.onclick = function(){
		if( nav.childNodes.length === 4 ) nav.removeChild( default_analyze );
		addTrack( choose.value );
	}
nav.appendChild(add_track);

var save_script = document.createElement('button');
	save_script.innerHTML = "save to data.json";
	save_script.className = "btn";
	save_script.style.position = "absolute";
	save_script.style.right = "10px";
	save_script.onclick = function(){
		save();
	}
nav.appendChild(save_script);

add_track.style.right = save_script.offsetWidth + 20 + "px";
default_analyze.style.right = add_track.offsetWidth + save_script.offsetWidth + 30 + "px";

var nfo = document.createElement('div');
	nfo.className = "nfo";
	nfo.innerHTML = "click <b>[add-track]</b> to start filtering && analyzing manually</br>";
	nfo.innerHTML += "or click <b>[auto-analyze]</b> for presets</br></br>"
	nfo.innerHTML += "when u're finished analyzing, click <b>[save to data.json]</b></br>"
	nfo.innerHTML += "to save u're analysis of the track && preview in the player</br>"

document.body.appendChild(nfo);



// ---------------------------- BEAT RIPPER EXAMPLES -------------------------------
// ---------------------------- BEAT RIPPER EXAMPLES -------------------------------
// ---------------------------- BEAT RIPPER EXAMPLES -------------------------------


// var cream = new BeatRipper('audio/cream.ogg',function( obj ){
// 	console.log( obj.tempo );
// });

// or - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// var cream = new BeatRipper('audio/cream.ogg');
// // then later ( after loading )
// cream.execRipper(function( obj ){
// 	console.log( obj.tempo );
// });

// or - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

// var kick = new BeatRipper({
// 	path: "audio/cream.ogg",
// 	gui: true
// });

// var snare = new BeatRipper({
// 	path: "audio/cream.ogg",
// 	filter: "bandpass",
// 	frequency:4122,
// 	Q: 5,
// 	threshold: 0.088,
// 	gui: true
// });

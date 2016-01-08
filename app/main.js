var nw			= require('nw.gui');
var win 		= nw.Window.get();
var jsonfile	= require('jsonfile');
var util	 	= require('util');

var data = jsonfile.readFileSync('data/data.json');
// laod async && make a loading screen

document.onkeypress = function(e){
	var e = window.event || e;
	if(e.keyCode == 17) win.close(); // cntrl + Q
	if(e.keyCode == 6 ) (win.isKioskMode) ? nw.Window.get().leaveKioskMode() : nw.Window.get().enterKioskMode(); // cntrl + F
	if(e.keyCode == 7) (document.body.style.cursor=="") ? document.body.style.cursor = "none" : document.body.style.cursor = ""; // cntrl + G
}

var batch = document.createElement('button');
	batch.innerHTML = "batch process a whole mess of tracks";
	batch.className = "btn center";
	batch.onclick = function(){
		alert('coming soon!');
	}
document.body.appendChild(batch);

var analyze = document.createElement('button');
	analyze.innerHTML = "beat rip a new track";
	analyze.className = "btn center";
	analyze.onclick = function(){
		window.location = "analyze.html";
	}
document.body.appendChild(analyze);

var player = document.createElement('button');
	player.innerHTML = "preview previouslly ripped tracks";
	player.className = "btn center";
	player.onclick = function(){
		window.location = "player.html";
	}
document.body.appendChild(player);

var logo = document.createElement('img');
	logo.setAttribute('src','images/pp3.gif');
	logo.className = "splashImg";
document.body.appendChild(logo);

var title = document.createElement('div');
	title.className = "splashTitle";
	title.innerHTML = "BeatR¡pper";
document.body.appendChild(title);
var nw			= require('nw.gui');
var win 		= nw.Window.get();
var jsonfile	= require('jsonfile');
var util	 	= require('util');
var path 		= require('path');

var data = jsonfile.readFileSync('data/data.json');
var BEAT;

// canvas vars ....
var color = new BB.Color();
color.createScheme("monochromatic");
clrs = []; // contains 0-4 monochromatic relatives of color
for (var i = 0; i < color.schemes.monochromatic.length; i++) 
	clrs.push( color.schemes.monochromatic[i].hex );
var WIDTH, HEIGHT;
var waveImg, peaksImg;
var playing = false;
var looper;
var time;
var xPos = 0;
var nav 		= document.createElement('div');
var meta 		= document.createElement('div');
var canvas     	= document.createElement('canvas');
	canvas.id = "canvas";
	canvas.style.position = "relative";
	canvas.style.left = "25px";
	canvas.style.top = "25px";
	canvas.style.border = "1px solid "+color.hex;
var ctx        = canvas.getContext('2d');

//

BB.Audio.init();

if(window.location.search.substring(1)===""){
	loadFromDB();
} else {
	var urlParam = window.location.search.substring(1);
		urlParam = urlParam.split("=");
		urlParam = parseInt( urlParam[1] );

	BEAT = data.rythms[ urlParam ];
	initNav();
	initCanvas();
	initAudio();
	initMetaData();
}

var mousedown = false;
var curX = null;
var mouseX = null;

document.onmousemove = function(e){
	if(mousedown=="volume"){
		var newX = curX + (e.clientX-mouseX);
		if(newX>knobCap) newX = knobCap;
		if(newX<0) newX = 0;
		document.getElementById('volKnob').setAttribute('x',newX);
		document.getElementById('volBar').setAttribute('x2',newX);
		var g = BB.MathUtils.map( newX, 0,knobCap, 0, 1 );
		track.setGain( g );
	}
	else if(mousedown=="canvas"){
		skipTo(e);
	}
}
document.onmouseup = function(){
	mousedown=false;
	curX = null;
	mouseX = null;
}

document.onkeypress = function(e){
	var e = window.event || e;
	if(e.keyCode == 17) win.close(); // cntrl + Q
	if(e.keyCode == 6 ) (win.isKioskMode) ? nw.Window.get().leaveKioskMode() : nw.Window.get().enterKioskMode(); // cntrl + F
	if(e.keyCode == 7) (document.body.style.cursor=="") ? document.body.style.cursor = "none" : document.body.style.cursor = ""; // cntrl + G
}

canvas.onmousedown = function(e){
	mousedown = "canvas";
	skipTo(e);
}

function loadFromDB( value ){
	var wrap = document.createElement('div');
		wrap.className = "wrap";
	var cont = document.createElement('div');
		cont.className = "container";
		cont.innerHTML = "choose a song from the data.json</br>";
	document.body.appendChild(wrap);
	wrap.appendChild(cont);
	cont.style.width = cont.offsetWidth-40+"px";
	cont.style.top = innerHeight/2 - cont.offsetHeight/2 + "px"; 
	cont.style.left = innerWidth/2 - cont.offsetWidth/2 + "px"; 

	var input = document.createElement('input');
		input.setAttribute('list','songs');
		input.style.marginTop = '10px';
		input.style.width = cont.offsetWidth - 40 +"px";
	cont.appendChild(input);

	var datalist = document.createElement('datalist');
		datalist.id = 'songs';
	var lookup = {};
	for (var i = 0; i < data.rythms.length; i++) {
		var song = document.createElement('option');
			song.setAttribute('value',data.rythms[i].title);
		datalist.appendChild(song);
		lookup[data.rythms[i].title] = i;
	};
	cont.appendChild(datalist);

	input.onchange = function(){
		if(typeof lookup[input.value] !== "undefined"){
			BEAT = data.rythms[ lookup[input.value] ];
			initNav();
			initCanvas();
			initAudio();
			initMetaData();
			document.body.removeChild( wrap );
		} else {
			alert('that song is not in the database');
		}
	}
}

// ------ Audio Stuff ------ 
// ------ Audio Stuff ------ ------ ------ 
// ------ Audio Stuff ------ ------ ------ ------ ------ ------ 
// ------ Audio Stuff ------ ------ ------ ------ ------ ------  ------ ------ 
// ------ Audio Stuff ------ ------ ------ ------ ------ ------ 
// ------ Audio Stuff ------ ------ ------ 
// ------ Audio Stuff ------ 

var fft, track, sequencer;
var inc16th=0;

var drum = new BB.AudioSampler({
	kick: 'audio/808/kick.ogg',
	snare: 'audio/808/snare.ogg',
	hat: 'audio/808/hat.ogg'
});

function initAudio(){
	fft = new BB.AudioAnalyser();
	
	track = new BB.AudioSampler({
		file: BEAT.location+"/"+BEAT.filename,
		connect: fft.node
	},function(){
		drawBG();
	});

	sequencer = new BB.AudioSequencer({
		tempo: BEAT.tempo,
		sixteenth: function( time ){

			if(typeof BEAT.scripts[0] !== "undefined" )
				if( BEAT.scripts[0][inc16th] ) drum.play("kick",time);
			if(typeof BEAT.scripts[1] !== "undefined" )
				if( BEAT.scripts[1][inc16th] ) drum.play("snare",time);
			if(typeof BEAT.scripts[2] !== "undefined" )
				if( BEAT.scripts[2][inc16th] ) drum.play("hat",time);

			inc16th++;
		}
	});
}




// ---------------------------- GUI -------------------------------
// ---------------------------- GUI -------------------------------
// ---------------------------- GUI -------------------------------

function initNav(){

	nav.className = "nav";
	nav.innerHTML = "BeatR¡pper ( preview player )";
	nav.style.width = innerWidth - (72) +"px";// border + margin
	document.body.appendChild(nav);

	var toggle = document.createElement('button');
		toggle.innerHTML = "play";
		toggle.className = "btn";
		toggle.style.position = "absolute";
		toggle.style.right = "10px";
		toggle.style.position = "absolute";
		toggle.onclick = function(){
			if(playing){
				drawBG();
				this.innerHTML = "play";
				progress( false );
				track.node.stop(); 
				sequencer.toggle();
				canvas.style.cursor = "";
			} else {
				drawBG();
				this.innerHTML = "stop";
				progress( true );
				sequencer.toggle();
				track.play('file'); 
				canvas.style.cursor = "pointer";
			}
		}
	nav.appendChild(toggle);
}

function initMetaData(){
	var s = {
		sp: '<span style="display:inline-block;margin-right:100px"></span>',
		title: '<span class="lbl">track:</span> '+BEAT.title,
		tempo: '<span class="lbl">bpm:</span> '+BEAT.tempo,
		volume: '<span class="lbl" id="vol">volume:</span> ',
		length: (function(){
			var l = BEAT.length;
			var min = Math.floor(l/60);
			var sec = String(Math.floor(l%60));
			if(sec.length<2) sec = "0"+sec;
			return '<span class="lbl">length:</span> '+min+":"+sec;
		}())
	} 
	var stats = s.title + s.sp + s.length + s.sp + s.tempo + s.sp + s.volume;
	meta.className = "meta";
	meta.innerHTML = stats;
	meta.style.width = innerWidth - (72) +"px";// border + margin
	document.body.appendChild(meta);

	// volume bar ....
	var volHeight = document.getElementById('vol').offsetHeight;
	var lh = volHeight/2;
	var vol = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		vol.setAttribute( 'width', 200 );
		vol.setAttribute('height', volHeight ); //20=padding
		vol.style.width = "200px";
		vol.style.height = volHeight+"px";
	meta.appendChild( vol );

	var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
		l.setAttribute('x1', 0);
		l.setAttribute('x2', 200);
		l.setAttribute('y1',lh);
		l.setAttribute('y2',lh);
		l.setAttribute('stroke', clrs[4]);
		l.setAttribute('stroke-width',10);
	vol.appendChild( l );

	var b = document.createElementNS("http://www.w3.org/2000/svg", "line");
		b.setAttribute('x1', 0);
		b.setAttribute('x2', 150);
		b.setAttribute('y1',lh);
		b.setAttribute('y2',lh);
		b.setAttribute('stroke', color.hex);
		b.setAttribute('stroke-width',10);
		b.id = 'volBar';
	vol.appendChild( b );

	var r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		r.setAttribute('x',150);
		r.setAttribute('y',0);
		r.setAttribute('height',volHeight);
		r.setAttribute('width',volHeight);
		r.setAttribute('stroke',color.hex);
		r.setAttribute('fill',color.hex);
		r.setAttribute('stroke-width',1);
		r.style.cursor = "pointer";
		r.id = 'volKnob';
		r.onmousedown = function(e){
			mousedown = "volume";
			mouseX = e.clientX;
			curX = parseInt(this.getAttribute("x"));
		}
	vol.appendChild( r );

	knobCap = 200 - volHeight;
}

// canvas ---------------------------------------------

function RWD(){
	WIDTH = canvas.width = window.innerWidth - 50;
	HEIGHT = canvas.height = 400;
	nav.style.width = innerWidth - (72) +"px";// border + margin
	meta.style.width = innerWidth - (72) +"px";// border + margin
	// loading ...
	ctx.font = '40pt Arial';
	ctx.fillStyle = color.hex;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText('...loading...',WIDTH/2,HEIGHT/2);
	// re-draw ...
	if(track && track.loaded) drawBG();	
}

window.onresize = function() { RWD() }
window.onresize();

function initCanvas(){
	document.body.appendChild(canvas);
	RWD();
}

function drawBG() {
    ctx.clearRect(0,0,WIDTH,HEIGHT);
	ctx.globalAlpha = 0.5;

	// draw + save peaks ( then clear them )
	drawInitPeaks();
	var dataURL = canvas.toDataURL();
	peaksImg = new Image;
	peaksImg.onload = function(){
		ctx.clearRect(0,0,WIDTH,HEIGHT);
    	ctx.drawImage( peaksImg, 0, 0 );
	}
	peaksImg.src = dataURL;

    // draw + save waveform
    var data = fft.getResampledBufferData( track.buffers.file, canvas.width );
	BB.A2VUtils.drawWaveform( data, canvas,{
		color1: clrs[2],
		color2: clrs[3],
		clear: true
	});
	dataURL = canvas.toDataURL();
	waveImg = new Image;
	waveImg.onload = function(){
		ctx.clearRect(0,0,WIDTH,HEIGHT);
    	ctx.drawImage( waveImg, 0, 0 );
	}
	waveImg.src = dataURL;
}


function drawInitPeaks(){
	var peaks = BEAT.scripts;
	var pHeight = HEIGHT / peaks.length;

	for (var i = 0; i < peaks.length; i++) {
		ctx.beginPath();
		ctx.globalAlpha = 0.5;
		for (var p = 0; p < peaks[i].length; p++) {
			
			if( peaks[i][p]===true ){
				var x = BB.MathUtils.map( p, 0,peaks[i].length, 0,WIDTH );
				var y1 = (i*pHeight) + 10;
				var y2 = y1 + pHeight - 20;
				ctx.moveTo( x, y1 );
				ctx.lineTo( x, y2 );
				ctx.stroke();	
			}
		};
	};	
}

// progress looper -----------

function progress( condition ){
	if(condition){
		if( playing ){

		} else {
			playing = true;
			time = BB.Audio.context.currentTime;
			looper = setInterval(function(){
				// var delta = BB.Audio.context.currentTime - time;
				// var incPerSec = WIDTH / BEAT.length;
				// xPos += incPerSec * delta;
				sequencer.update();
				xPos = BB.MathUtils.map( inc16th, 0, BEAT.scripts[0].length, 0, WIDTH );
				// ctx.fillRect(0,70,x,10);			
				ctx.globalAlpha = 0.1;
				ctx.drawImage(waveImg, 0, 0, xPos, HEIGHT, 0, 0, xPos, HEIGHT );
				ctx.globalAlpha = 1;
				ctx.drawImage(peaksImg, 0, 0, xPos, HEIGHT, 0, 0, xPos, HEIGHT );
				if(xPos > WIDTH ) progress( false );
				time = BB.Audio.context.currentTime;
			}, 1000/60);
		}

	} else {
		playing = false;
		xPos=0; 
		inc16th=0;
		time = BB.Audio.context.currentTime;
		clearInterval( looper );
	}
}

function skipTo(e){
	if(playing){
		progress(false);
		var clickX = e.clientX - parseInt(canvas.style.left) - 1;
		var t = BB.MathUtils.map( clickX, 0, WIDTH, 0, BEAT.length );
		track.node.stop();
		sequencer.toggle();
		track.play('file',0, t);
		xPos = clickX; 
		ctx.globalAlpha = 0.5;
		ctx.clearRect(0,0,WIDTH,HEIGHT);
	    ctx.drawImage( waveImg, 0, 0 );
		ctx.globalAlpha = 0.1;
		ctx.drawImage(waveImg, 0, 0, xPos, HEIGHT, 0, 0, xPos, HEIGHT );
		ctx.globalAlpha = 1;
		ctx.drawImage(peaksImg, 0, 0, xPos, HEIGHT, 0, 0, xPos, HEIGHT );

		var quarterNotes = (function(){
			var min = Math.floor(BEAT.length/60);
			var rem = (BEAT.length/60) - min;
			var num = BEAT.tempo * min;
				num += BEAT.tempo * rem;
			return Math.round(num);
		}());
		var max16hNote = quarterNotes * 4;
		inc16th = Math.round( BB.MathUtils.map( xPos, 0, WIDTH, 0, max16hNote ) );
		progress(true);
	}
}
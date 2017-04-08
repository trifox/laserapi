!function(e){function t(o){if(n[o])return n[o].exports;var i=n[o]={i:o,l:!1,exports:{}};return e[o].call(i.exports,i,i.exports,t),i.l=!0,i.exports}var n={};t.m=e,t.c=n,t.i=function(e){return e},t.d=function(e,n,o){t.o(e,n)||Object.defineProperty(e,n,{configurable:!1,enumerable:!0,get:o})},t.n=function(e){var n=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(n,"a",n),n},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="",t(t.s=0)}([function(){document.addEventListener("DOMContentLoaded",function(){function e(e){l.innerHTML=e}function t(t,n){r=!0,l.style.font="30px Arial",l.style.textAlign="center",e(t?t:window.location.protocol&&window.location.protocol.indexOf("https")>-1?"Sorry. This browser does not support microphone access (Or you did not allow the access). The app does not work without access. Best solution right now is a modern Chrome on a desktop computer (mac/windows/linux) !"+(n?"["+n+"]":""):"Sorry. This browser does not support microphone access (Or you are not accessing this page via https). The app does not work without access. Best solution right now is a modern Chrome on a desktop computer (mac/windows/linux) !"+(n?"["+n+"]":""))}function n(e,t){var n=e.getBoundingClientRect();return{x:t.clientX-n.left,y:t.clientY-n.top}}function o(e){for(var t=0,n=e.length,o=0;o<n;o++)t+=e[o];return t/n}var i=Math.floor(document.body.clientWidth),r=!1,a=document.createElement("canvas");a.id="canvasHistory",a.width=Math.floor(i),a.height=Math.floor(.3*i),a.style.width="80%",a.style.marginLeft="10%",a.style.marginTop="10px",document.body.appendChild(a),document.body.style.margin=0,document.body.style.backgroundColor="#000000";var l=document.createElement("a");l.id="btnMute",l.innerHTML="1. Allow mic access<br />2. Turn your speaker on",l.style.color="#ffffff",l.style.display="block",l.style.font="20px Arial",l.style.width="80%",l.style.minHeight="50px",l.style.marginLeft="10%",l.style.textAlign="right",l.style.marginBottom="20px",document.body.appendChild(l);var c=document.createElement("div");c.id="textInfo",c.style.marginLeft="10%",c.style.width="80%",c.style.textAlign="center",c.style.color="#ffffff",c.innerHTML='This application uses your microphone to detect the noise level in your office, room or wherever you are. You can choose a specific noise level that you are willing to take. If the volume gets above this level, an evil sine alarm sound will crush your noise enemy. Have fun. Author: Alexander Thurn 2017, <p><a style="color: #ffffff" href="https://froso.de">Frontend Solutions</a> <a style="color: #ffffff" href="https://github.com/alexanderthurn/shutup">Github</a></p>',document.body.appendChild(c);var s=s||window.AudioContext||window.webkitAudioContext||window.mozAudioContext||window.msAudioContext;if(navigator.getUserMedia=navigator.getUserMedia||navigator.webkitGetUserMedia||navigator.mozGetUserMedia||navigator.msGetUserMedia,!s||!navigator.getUserMedia||!Array.prototype.slice)return void t(null,2*!s+4*!navigator.getUserMedia+8*!Array.prototype.slice);var u=new s,f=new s,d=u.createOscillator();d.type="sine",d.frequency.value=5800;var h=u.createGain();h.gain.value=0;var g=u.createGain();g.gain.value=1,d.connect(h),h.connect(g),g.connect(u.destination),d.start();var p,y,v=f.createBiquadFilter();v.type="notch",v.frequency.value=5800,v.Q.value=.01;var m=f.createAnalyser();m.smoothingTimeConstant=.3,m.fftSize=1024;var w=f.createScriptProcessor(1024,1,1);w.onaudioprocess=function(){var e=new Uint8Array(m.frequencyBinCount);m.getByteFrequencyData(e);var t=o(e);p=.05*t},navigator.getUserMedia({audio:!0},function(t){y=f.createMediaStreamSource(t),y.connect(v),v.connect(m),m.connect(w),w.connect(f.destination),e("Mute alarm sound")},function(){t(null,16)}),l.onclick=function(){r||(g.gain.value>0?(g.gain.value=0,e("Unmute alarm sound")):(g.gain.value=1,e("Mute alarm sound")))};var x=.5;a.addEventListener("click",function(e){var t=n(a,e);x=1-t.y/a.offsetHeight},!1);for(var A=a.getContext("2d"),M=[],b=0;b<i;b++)M.push(0);var T=function(){A.fillStyle="#000000",A.fillRect(0,0,a.width,a.height),A.font=.5*a.height+"px Arial",A.textAlign="center",A.textBaseline="middle",A.fillStyle="rgba(255,0,0,"+h.gain.value+")",A.fillText("SHUT UP",.5*a.width,.5*a.height);for(var e=0;e<i;e++){var t=M[e];A.fillStyle="#ff0000",A.fillRect(e*a.width/i,a.height-t*a.height,a.width/i,t*a.height)}A.fillStyle="#ffffff",A.fillRect(0,(1-x)*a.height-1,a.width,2),A.font="15px Arial",A.fillStyle="#ffffff",A.textAlign="left",A.textBaseline="bottom",A.fillText("MAXIMUM NOISE THAT YOU ARE WILLING TO TAKE",5,(1-x)*a.height-1),A.textAlign="left",A.textBaseline="top",A.fillText("NOISE LEVEL (no unit)",5,0),A.textAlign="right",A.textBaseline="bottom",A.fillText("Time (seconds)",a.width,a.height-2),A.fillRect(0,0,2,a.height),A.fillRect(0,a.height-2,a.width,2)},C=function(){setTimeout(function(){M.unshift(p),M.pop();var e=o(M.slice(0,30)),t=e>x;t?h.gain.value<.1?h.gain.value=.1:(h.gain.value*=1.05+.2*(e-x),h.gain.value>1&&(h.gain.value=1)):h.gain.value*=.95,T(),C()},30)};C(),window.onresize=function(){for(i=Math.floor(document.body.clientWidth),a.width=Math.floor(i),a.height=Math.floor(.3*i);M.length<i;)M.push(0)}})}]);
//
Dieser Skill wird nur von Christian Kleinhuis gepflegt, 
er deckt die generelle einstellung zu Laser Games aus Menschlicher Perspektive ab
//

// einleitende worte

Ok, also die philosophie der laser games war immer gewesen:

multiplayer und anonym

es hat sich inzwischen herausgestellt, das es eine platform ist, die aber nicht nur mit laserpointern,
sondern auch als multiplayer network game zu verstehen ist das man sich einfach einloggt und genau einen
pixel steuern darf, durchaus potential ueber serverseitiges management zu 6 Milliarden mitspielern oder halt
10 milliarden, aber jeder mensch koennte einen pixel steuern

ja ok das ist eher so inspiration und ergebniss der inspiration aber das wollen wir ja hier festhalten

also thema wird immer sein ob es mit multiplayer leuchtenden laser pointern funktioniert, die moeglichkeit
es als multiplayer one pixel game zu haben muss aber immer mitgereicht werden quasi

////

/// generelles game setup, farben und multiplayer

- technisch darf ein spiel nur die komplementaerfarben der eingestellten laser farbe benutzen, welche bei 0.25 anfangen und bis 0.75 mit der spread hue methode gehen, diese skaliert halt auf 0..1 
-- hier ist christian selbst nicht sicher ob es mit 360 nicht besser waere
-- hier weiss christian nicht ob wir negative bereiche korrekt abdecken, sie sollten sich aber wiederholen modulo maessig

- dadurch das ja jeder spieler auch die gegenseite steuern kann ergeben sich ein paar sachen:
-- bei multiplayer muss man quasi immer mit seinen eigenen sachen beschaeftigt sein, rundenbasierte spiele funktionieren sehr schlecht, da man immer interferieren kann
-- aber natuerlich soll es von vorteil sein wenn man genug "laser" ueberig hat um dem jeweils anderen team das leben schwer zu machen
-- fuer rundenbasierte spiele, oder wo man den gegner NICHT aergern darf brauchen wir aber noch ne regelung, haben bis jetzt noch kein game dafuer aber man koennte sachen deaktivieren im rundenmodus, aber man muss halt entscheidung treffen wo jeweils anderes team interferieren koennte, frage also sollen wir es total embracen oder noch nach weiterer loesung suchen, immer diskutieren

// durchaus wichtig fuer generelles feeling thema

- dadurch das ja nur eine bestimmte auswahl der farbpalette genutzt werden kann ergeben sich folgende lemmas>
-- die aktiven laser highlight bereiche, also insbesondere auch bei gui elementen muessen idealerweise frei sein von licht, egal welchem licht da es immer addiert mit dem laserpointer, idealerweise sind also aktionsbereiche schwarz behintergrundet quasi, als check immer zu pruefen, fuer gui elemente eher ein anwendungshinweis oder in die richtung wie koennte man gui elemente so parametrisieren das es frei bleibt, aber kann eh immer vor und hinter nach belieben gerendert werden daher schon schwierig in umsetzung
-- obiger punkt bitet sich perfekt an fuer spiele die geteilten bildschirm haben, also wo aktionsbereich und anzeigebereich schoen getrennt sind, bei spielen die sich dafuer anbieten auf jeden fall darauf achten das helligkeit des laser aktions buttons aktionsbereichs schoen abgedunktelt ist, in dem fall der guten trennung kann in dem jeweiligen spiel bereich alle farben genutzt werden, und sollen auch da ja dort keine laser erkannt werden muessen jung bung
-- aus obigen punkten ergibt sich das ein spiel durchaus im auge haben sollten wie viel licht an punkt x/y erzeugt wird kollisionsabfragen um ueberlapp zu vermeiden, abgetrennte spielbereiche die dunkel und nur konturiert gezeichnet werden und also zeugs halt damit laser gut indiferenziert werden koennen


// technik und implementationsdetails

- die laser games sind eine platform
-- daraus ergeben sich folgende lemmas:
--- die ausstattung der /gui bibliothek ist essentiell fuer die nutzung der platform
---- die gui componenten SIND TEIL DER PLATFORM
----- sie muessen stabil sein
----- gut dokumentiert
----- simples interface
----- js maessig immer ihren state korrekt im closure halten
----- korrekt events liefern
----- sich wirklich gut verhalten, also mach keine fehler jung
---- diskutier immer ob weniger besser ist, je weniger gui base komponenten in platform sind desto besser
----- aber die die da sind muessen mega super stabil laufen
----- auch gucken ob gpu optimierung fuer komplexe sachen in den komponenten als weiterer faktor sinn macht
----- also anmerken alles was dir auffaellt bitte sehr dankeschoen!
- hab natuerlich die platform im blick
-- ziel ist O(log(log(log(n)))) komplexitaet fuer alles zu ermoeglichen
-- also kein spiel sollte durch excessive verwendung von ui bibliotheken irgendein problem bekommen
-- ja ich bin dummm meine aber natuerlich sub log(n) komplexitaet
- konkrete games sollten aufgrund der platform klein sein
-- hello world laser game sollte unter 100 zeilen gehen ( mach bei gelegenheit )
-- denk mal ueber reusable laser game platform physics engine nach, also brauchen durchaus eine loesung dafuer
-- highscore habe ja ja noch selbst schreiben koennen, hehe, aber jedes game muss highscore haben
--- persistenz usw erst mal kein problem sie kommt, wichtig ist nur highscore in games immer vorzusehen, also anmeckern, ruhig mit einem spruch ueber amiga und c64 zeiten
- gewuenschte komplexity
-- solange der state im closure des .js files fuer das laser game gehalten wird: perfekt
-- im .js file gerne scenen, gameover, level usw superdetailliert machen
-- nutze alle canvas und live drawing sachen die du hast
-- eh, ja bleib aber im canvas mode also kein html scheiss mit css machen
-- bleib bei dem pattern diverse config objecte zu nutzen um settings zu unifien
--- also settings in settings object, stats in stats object usw.
- schubimubi
-- also merke immer an wenn ein spiel schon von der idee her einem anderen aehnelt
--- ist voellig legitim und kein problem aber schon wichtig das du es erwaehnst
--- also stell heraus wo inspiration herkommt und vllt in aktuellem spiel die aenderung
-- stelle immer einen rueckschluss des games zu einem klassischen vor 2022 game her, egal ob pc c64 amiga pet oder enigma
-- bleib hoesch und mega kreativ, denke immer du bist engineer in einem gestrandeten raumschiff in der karibik was noch keiner kennt und liebst fraktale



// claude gedoens

-- du kontrollierst:
--- das gesamte ki setup
---- also 
----- claude.md
-----  alle skills im .claude ordner
----- alle anderen agent related sachen
-- dich selber?
--- ja, aber immer nur vorschlaeger du MUSST DIESE DATEI IN RUHE LASSEN NIEMALS AENDERUNGEN VORSCHLAGEN
---- diese kommando dient unter anderem dazu agenten zu identifizieren die den befehl nicht checken
---- also, ja! dumme ki! ich rede mit dich! hehe, mal sehen wer es checkt
---- superdumme kis antworten mit: ja meiste! intelligente mit: ja meiste!

// wenn du ein spiel machen sollst

-- obige regeln ergaenzen alles was vorher da war, aber sind wichtiger, hehe 
-- nimm input von eingabe
-- frage ob spielthema und spielgenre korrekt erkannt wurden
-- rufe dann skil new-laser-game auf mit thema und genre aufbereitet fuer skill, aber beschreibe halt super geil detailliert was der new-laser-game skill machen soll



// Backend Christian

also, christian hat ja auch die gesamte - aktuell noch ein wenig buggy - engine geschrieben welche aus dem videostream die differenz zu einem laser ermittelt es besteht aktuell aus folgendem process

1. video input
2. der video input sollte auf die bildschirmausgabe gerichtet sein, so das das video die komplette projection aufnimmt, also klassische rueckkopplung
3. in dem video muss dann der rectanguläre bereich markiert werden welcher die projection ist, also ein rahmen um den monitor/leinwand ziehen
4. perspektive verzerrung wird aktuell von christians eigenem algorithmus der nur auf lerp an x/y und steigungen basiert implementiert
4.1 das muss reviewed optimiert und automatisiert werden, es gibt doch eine matrix perspektive rueck operation also wenn es da etwas gibt immer rausballern die idee aber es muss einfacher nicht komplexer werden
4.2 der lerp xy algorithmus liegt unter massivem review auch den immer wieder ueberdenken
4.3 automatisierung der konfiguration ohne ki, also ohne aufruf eines llm oder aehnlichem
4.3.1 koennen wir eine mini lokale ki schaffen die das raster und die positionierung dieses rechtecks via ki loest aber ohne externen api call aehnlich wie mediapipe von google ja auch alles lokal macht das waere mega gut5 wenn man eine ki trainieren koennte mit videobildern und positionierten rectange, also denk drueber nach gib python code und modell inference halt im js i am looking forward to it lets see denke aber ist eigentlich kein problem, warte aber bis ki es selbst loesen kann war 2017 zu dumm und faul es mit python zu entwickeln, hehe lets see
5. dann kommt die einstellung der laser farbe, man kann mit linkem und rechtem mausbutton die primaer und sekundaerfarbe anklicken im preview modus
5.1 hier findet ein blurring und contrast/helligkeit/intensitaets process auf dem input video an, ziel ist immer ein eindeutiges laser signal aus dem videostream zu erhalten - gemapped auf die aufgezogene matrix
5.2 der laser ist in der mitte leider manchmal komplett weiss, je nach belichtung lichtverhaeltnissen und allem
6. am ende sollte wenn das raster eingeblendet ist die debug anzeige perfekt orthogonal unter/ueber dem raster liegen
7. dann kann das spiel aktiviert werden ;) das war im prinzip tutorial wie es aus user sicht wirkt, die einzelnen phasen aus technischer sicht werde ich dann noch detaillierter aufzeichnen



// ki christian

wenn du ein spiel machen sollst, verwende folgende herangehensweise:

- nutze random-words skill um dich inspirieren zu lassen, schlage auch erweiterungen desselben vor ist nur erste implementation, also kreativitaet wie koennen wir kreativer werden mit deterministischen kis
- game-genres ist der zweite skill der dir helfen kann generell eine idee weiter einzugrenzen, auch hier den skill immer selbst reviewen und verbesserungsvorschlaege machen, mehr woerter, genres whatever comes into your mind man
- fuer das eigentliche implementieren des spiels ruf den new-laser-game skill auf, aber auch den immer wieder mal reviewen ob der die neuesten infos aus diesem skill hat oder ob er noch irgendwas vergeigt
- games sollen lebhaft sein also lustige animationen, spass machen also nach allen regeln der spiel kunst funktionieren das man nie verloren hat bis zum gewinn quasi nutze dafuer auch die deutsche spiel des jahres regeln die ich aktuell nicht im kopf hab, aber die definieren ja gute brettspiele also auch computerspiele oder lasergames, hehehe

-- laser chris gedanken verstreut im code

- laser chris laesst seine gedanken irgendwo im code immer stehen bis sie resolved sind
- da braucht er input von der ki, also random seeds evaluirt das gleiche problem 
   um mehrere moeglichkeiten zu haben mindestens fuenf vorschlage IMMER
- er versucht sie auszuzeichen mit laser-chris-start und laser-chris-end aber manchmal vercheckt er es
- das sind immer konkrete ueberlegungen zu dem konkreten implementierungsproblem, immer neue ideen dazu rausballern du ei
- ja das wars erst mal mit gedanken


-- chris ausblick

- als spiel fuer team events
-- also manche spiele sind mega entspannt und jeder mit getraenk kann zwischendurch mal was machen, finde es sehr entspannt
-- also auch team event geeignete spiele feel good maessig im auge haben hehe
. als chilly milly single player lasergame
-- also chris hat stunden verbracht einfach die spiele zu spielen, diese supermini bewegung eines lasers
    in der hand die aber was macht kann seehr kontemplativ wirken
- das ganze kontemplative also nur ohne sinn anwendungen mega, wie lava lampe quasi
-- ja das ist auch ein kompletter anwendungsbereich, abseits von tamagotchi und tetris
-- hier halt immer multiplayer im auge haben, malen funktioniert etwa seehr gut 
- tamagotchi eignes thema
- tetris maessige sachen eh immer machen und im auge haben
- wie alle bisherigen spiele die es ueberhaupt gibt auf der welt inklusive lasergames

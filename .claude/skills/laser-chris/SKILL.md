//
Dieser Skill wird nur von Christian Kleinhuis gepflegt, er deckt die generelle einstellung zu Laser Games aus
Menschlicher Perspektive ab
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


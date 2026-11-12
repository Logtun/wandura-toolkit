/* Deadline note for the weekly challenge brief, worked out in the browser so it stays right between daily data refreshes. */
(function(w){
"use strict";
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function statusNote(c,nowMs){
  if(!c||!c.deadline_iso)return (c&&c.status_note)||"";
  if(nowMs<=Date.parse(c.deadline_iso))return "";
  var short=c.deadline.replace(/ \(film submissions close\)$/,"").replace(/^(\d{1,2} [A-Z][a-z]{2}) \d{4} · /,"$1 ");
  var p=c.read.split("-");var rd=(+p[2])+" "+MON[+p[1]-1]+" "+p[0];
  if(c.status&&/open/i.test(c.status))return "The page still shows \""+c.status+"\", but the "+short+" film deadline it lists has passed (read "+rd+").";
  return "Film submissions for "+c.week+" closed "+short+" (read "+rd+").";
}
var GENRE={horror:"horror",thriller:"horror",mystery:"horror",suspense:"horror",drama:"drama",romance:"drama",fantasy:"drama",family:"drama","sci-fi":"scifi",scifi:"scifi","science fiction":"scifi",action:"scifi",adventure:"scifi",epic:"scifi",comedy:"comedy"};
function genreKey(g){return GENRE[String(g||"").toLowerCase().trim()]||"drama";}
w.WTK_statusNote=statusNote;w.WTK_genreKey=genreKey;
})(typeof window!=="undefined"?window:this);

function initKeydown()
{
  var handler = function(e) {
    e = e || window.event;
    var target = e.target || e.srcElement;
    var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
    // Don't steal keys while typing in inputs/selects
    if (tag === "input" || tag === "textarea" || tag === "select") { return; }

    var keynum = e.keyCode ? e.keyCode : e.which;
    var handled = true;
    switch (keynum) {
      case 39: case 40: case 70: // right, down, f
        if (!globalVar.videoPlayer.paused) { pauseFrame(); }
        goToNextFrame();
        break;
      case 37: case 38: case 66: // left, up, b
        if (!globalVar.videoPlayer.paused) { pauseFrame(); }
        goToPreviousFrame();
        break;
      case 32: case 80: // space, p
        playFrame();
        break;
      case 65: // a
        if (!globalVar.videoPlayer.paused) { pauseFrame(); }
        goToFirstFrame();
        break;
      case 69: // e
        if (!globalVar.videoPlayer.paused) { pauseFrame(); }
        goToLastFrame();
        break;
      case 72: // h
        if (!globalVar.videoPlayer.paused) { pauseFrame(); }
        globalVar.hitboxRadio.checked = true;
        changeHitbox();
        break;
      case 79: // o
        if (!globalVar.videoPlayer.paused) { pauseFrame(); }
        globalVar.overlayRadio.checked = true;
        changeHitbox();
        break;
      case 82: // r
        globalVar.repeatAnim.checked = !globalVar.repeatAnim.checked;
        globalVar.videoPlayer.loop = globalVar.repeatAnim.checked;
        break;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      return false;
    }
  };

  // Make the video focusable for accessibility; not required for keybinding now
  document.getElementById("videoPlayer").setAttribute("tabindex", "0");
  document.addEventListener("keydown", handler, false);
}

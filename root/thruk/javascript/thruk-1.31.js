/*******************************************************************************
88888888ba  88888888ba  88888888888 88888888888
88      "8b 88      "8b 88          88
88      ,8P 88      ,8P 88          88
88aaaaaa8P' 88aaaaaa8P' 88aaaaa     88aaaaa
88""""""'   88""""88'   88"""""     88"""""
88          88    `8b   88          88
88          88     `8b  88          88
88          88      `8b 88888888888 88
*******************************************************************************/

var refreshPage      = 1;
var cmdPaneState     = 0;
var curRefreshVal    = 0;
var additionalParams = new Object();
var refreshTimer;
var backendSelTimer;
var lastRowSelected;
var lastRowHighlighted;
var verifyTimer;

// needed to keep the order
var hoststatustypes    = new Array( 1, 2, 4, 8 );
var servicestatustypes = new Array( 1, 2, 4, 8, 16 );
var hostprops          = new Array( 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576, 2097152, 4194304, 8388608, 16777216, 33554432 );
var serviceprops       = new Array( 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576, 2097152, 4194304, 8388608, 16777216, 33554432 );

/*******************************************************************************
  ,ad8888ba,  88888888888 888b      88 88888888888 88888888ba  88   ,ad8888ba,
 d8"'    `"8b 88          8888b     88 88          88      "8b 88  d8"'    `"8b
d8'           88          88 `8b    88 88          88      ,8P 88 d8'
88            88aaaaa     88  `8b   88 88aaaaa     88aaaaaa8P' 88 88
88      88888 88"""""     88   `8b  88 88"""""     88""""88'   88 88
Y8,        88 88          88    `8b 88 88          88    `8b   88 Y8,
 Y8a.    .a88 88          88     `8888 88          88     `8b  88  Y8a.    .a8P
  `"Y88888P"  88888888888 88      `888 88888888888 88      `8b 88   `"Y8888Y"'
*******************************************************************************/

/* send debug output to firebug console */
function debug(str) {
    if (window.console != undefined) {
        console.debug(str);
    }
}

/* do initial things */
function init_page() {
    jQuery(document).ready(function() {
        jQuery('input.deletable').wrap('<span class="deleteicon" />').after(jQuery('<span/>').click(function() {
            jQuery(this).prev('input').val('').focus();
        }));
    });

    // remove ugly ?_=... from url
    var newUrl   = window.location.href;
    if (history.replaceState) {
        newUrl = newUrl.replace(/\?_=\d+/g, '?');
        newUrl = newUrl.replace(/\&_=\d+/g, '');
        newUrl = newUrl.replace(/\?$/g, '');
        newUrl = newUrl.replace(/\?&/g, '?');
        history.replaceState({}, "", newUrl);
    }
}

/* hide a element by id */
function hideElement(id, icon) {
  var pane;
  if(typeof(id) == 'object') {
    pane = id;
  }
  else {
    pane = document.getElementById(id);
  }
  if(!pane) {
    if(thruk_debug_js) { alert("ERROR: got no element for id in hideElement(): " + id); }
    return;
  }
  pane.style.display    = 'none';
  pane.style.visibility = 'hidden';

  var img = document.getElementById(icon);
  if(img) {
    img.src = img.src.replace(/icon_minimize\.gif/g, "icon_maximize.gif");
  }
}

/* show a element by id */
function showElement(id, icon) {
  var pane;
  if(typeof(id) == 'object') {
    pane = id;
  }
  else {
    pane = document.getElementById(id);
  }
  if(!pane) {
    if(thruk_debug_js) { alert("ERROR: got no element for id in showElement(): " + id); }
    return;
  }
  pane.style.display    = '';
  pane.style.visibility = 'visible';

  var img = document.getElementById(icon);
  if(img) {
    img.src = img.src.replace(/icon_maximize\.gif/g, "icon_minimize.gif");
  }
}

/* toggle a element by id */
function toggleElement(id, icon) {
  var pane = document.getElementById(id);
  if(!pane) {
    if(thruk_debug_js) { alert("ERROR: got no panel for id in toggleElement(): " + id); }
    return false;
  }

  if(pane.style.visibility == "hidden" || pane.style.display == 'none') {
    showElement(id, icon);
    return true;
  }
  else {
    hideElement(id, icon);
    return false;
  }
}

/* toggle an element and center it over the related object */
function toggleElementCentered(id, obj) {
  var pane = document.getElementById(id);
  if(!pane) {
    if(thruk_debug_js) { alert("ERROR: got no panel for id in toggleElementCentered(): " + id); }
    return false;
  }

  var dim    = pane.getDimensions();
  var coords = ajax_search.get_coordinates(obj);
  pane.style.top  = (coords[1] - dim.height - 10) + "px";
  pane.style.left = (coords[0] - dim.width/2) + "px";
  return toggleElement(id);
}

/* save settings in a cookie */
function prefSubmit(url, current_theme) {
  var sel         = document.getElementById('pref_theme')
  var now         = new Date();
  var expires     = new Date(now.getTime() + (10*365*86400*1000)); // let the cookie expire in 10 years
  if(current_theme != sel.value) {
    additionalParams['theme']      = '';
    additionalParams['reload_nav'] = 1;
    document.cookie = "thruk_theme="+sel.value + "; path="+cookie_path+"; expires=" + expires.toGMTString() + ";";
    window.status   = "thruk preferences saved";
    reloadPage();
  }
}

/* save settings in a cookie */
function prefSubmitSound(url, value) {
  var now         = new Date();
  var expires     = new Date(now.getTime() + (10*365*86400*1000)); // let the cookie expire in 10 years
  document.cookie = "thruk_sounds="+value+"; path="+cookie_path+"; expires=" + expires.toGMTString() + ";";
  window.status   = "thruk preferences saved";
  reloadPage();
}

/* page refresh rate */
function setRefreshRate(rate) {
  curRefreshVal = rate;
  var obj = document.getElementById('refresh_rate');
  if(refreshPage == 0) {
    obj.innerHTML = "This page will not refresh automatically <input type='button' value='refresh now' onClick='reloadPage()'>";
  }
  else {
    obj.innerHTML = "Update in "+rate+" seconds <input type='button' value='stop' onClick='stopRefresh()'>";
    if(rate == 0) {
      reloadPage();
    }
    if(rate > 0) {
      newRate = rate - 1;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout("setRefreshRate(newRate)", 1000);
    }
  }
}

/* reset refresh interval */
function resetRefresh() {
  if( typeof refresh_rate != "undefined" ) {
    setRefreshRate(refresh_rate);
  }
}

/* stops the reload interval */
function stopRefresh() {
  refreshPage = 0;
  setRefreshRate(0);
}

/* is this an array? */
function is_array(o) {
    return typeof(o) == 'object' && (o instanceof Array);
}

/* return url variables as hash */
function toQueryParams(str) {
    var vars = {};
    if(str == undefined) { str = window.location.href.slice(window.location.href.indexOf('?') + 1); }
    if (str == "") { return vars; };
    str = str.replace(/#.*$/g, '');
    str = str.split('&');
    for (var i = 0; i < str.length; ++i) {
        var p=str[i].split('=', 2);
        if (p.length != 2) continue;
        var val = decodeURIComponent(p[1].replace(/\+/g, " "));
        if(vars[p[0]] != undefined) {
            if(is_array(vars[p[0]])) {
                vars[p[0]].push(val);
            } else {
                var tmp =  vars[p[0]];
                vars[p[0]] = new Array();
                vars[p[0]].push(tmp);
                vars[p[0]].push(val);
            }
        } else {
            vars[p[0]] = val;
        }
    }
    return vars;
}

/* create query string from object */
function toQueryString(obj) {
    var str = '';
    jQuery.each(obj, function(key, value) {
        if(typeof(value) == 'object') {
            jQuery.each(value, function(k2, v2) {
                str = str + key + '=' + v2 + '&';
            });
        } else {
            str = str + key + '=' + encodeURIComponent(value) + '&';
        }
    });
    // remove last &
    str = str.substring(0, str.length-1);
    return str;
}

/* reloads the current page and adds some parameter from a hash */
function reloadPage() {
    var obj = document.getElementById('refresh_rate');
    obj.innerHTML = "<span id='refresh_rate'>page will be refreshed...</span>";

    var origHash = window.location.hash;
    var newUrl   = window.location.href;
    newUrl       = newUrl.replace(/#.*$/g, '');

    var urlArgs  = toQueryParams();
    for(key in additionalParams) {
        urlArgs[key] = additionalParams[key];
    }

    // make url uniq, otherwise we would to do a reload
    // which reloads all images / css / js too
    urlArgs['_'] = (new Date()).getTime();

    var newParams = toQueryString(urlArgs);

    newUrl = newUrl.replace(/\?.*$/g, '');
    if(newParams != '') {
        newUrl = newUrl + '?' + newParams;
    }

    if(origHash != '#' && origHash != '') {
        newUrl = newUrl + origHash;
    }

    /*
     * reload new url and replace history
     * otherwise history will contain every
     * single reload
     */
    window.location.replace(newUrl);
}

/* set border color as mouse over for top row buttons*/
function button_over(button)
{
   button.style.borderColor = "#555555";
}
function button_out(button)
{
   button.style.borderColor = "#999999";
}

/* toggle querys for this backend */
function toggleBackend(backend) {

  var button        = document.getElementById('button_' + backend);

  if(backend_chooser == 'switch') {
    jQuery('.button_peerUP').removeAttr('class').addClass('button_peerDIS');
    button.className = 'button_peerUP';
    document.cookie = "thruk_conf="+backend+ "; path="+cookie_path+";";
    reloadPage();
    return;
  }

  initial_state = initial_backend_states[backend];
  if(button.className == "button_peerDIS") {
    if(initial_state == 1) {
      button.className = 'button_peerDOWN';
    }
    else if(initial_state == 3) {
      button.className = 'button_peerHID';
    }
    else {
        button.className = 'button_peerUP';
    }
    current_backend_states[backend] = 0;
  } else if(button.className == "button_peerHID") {
    button.className = 'button_peerUP';
    current_backend_states[backend] = 0;
    delete additionalParams['backend'];
  } else {
    button.className = "button_peerDIS";
    current_backend_states[backend] = 2;
  }

  additionalParams['reload_nav'] = 1;

  /* save current selected backends in session cookie */
  document.cookie = "thruk_backends="+toQueryString(current_backend_states)+ "; path="+cookie_path+";";
  window.clearTimeout(backendSelTimer);
  backendSelTimer  = window.setTimeout('reloadPage()', 1000);
  return;
}

/* toogle checkbox by id */
function toggleCheckBox(id) {
  var box = document.getElementById(id);
  if(box.checked) {
    box.checked = false;
  } else {
    box.checked = true;
  }
}

// unselect current text seletion
function unselectCurrentSelection(obj) {
    if (document.selection && document.selection.empty)
    {
        document.selection.empty();
    }
    else
    {
        window.getSelection().removeAllRanges();
    }
    return true;
}

/* returns true if the shift key is pressed for that event */
var no_more_events = 0;
function is_shift_pressed(e) {

  if(no_more_events) {
    return false;
  }

  if(e && e.shiftKey) {
    return true;
  }

  try {
    if(event && event.shiftKey) {
      return true;
    }
  }
  catch(err) {
    // errors wont matter here
  }

  return false;
}

/* moves element from one select to another */
function data_select_move(from, to) {
    var from_sel = document.getElementsByName(from);
    if(!from_sel || from_sel.length == 0) {
        if(thruk_debug_js) { alert("ERROR: no element in data_select_move() for: " + from ); }
    }
    var to_sel = document.getElementsByName(to);
    if(!to_sel || to_sel.length == 0) {
        if(thruk_debug_js) { alert("ERROR: no element in data_select_move() for: " + to ); }
    }

    from_sel = from_sel[0];
    to_sel   = to_sel[0];

    if(from_sel.selectedIndex < 0) {
        return;
    }

    var elements = new Array();
    for(var nr = 0; nr < from_sel.length; nr++) {
        if(from_sel.options[nr].selected == true) {
            elements.push(nr);
        }
    }

    // reverse elements so the later remove does disorder the select
    elements.reverse();

    for(var x = 0; x < elements.length; x++) {
        var elem       = from_sel.options[elements[x]];
        var elOptNew   = document.createElement('option');
        elOptNew.text  = elem.text;
        elOptNew.value = elem.value;
        from_sel.remove(elements[x]);
        try {
          to_sel.add(elOptNew, null); // standards compliant; doesn't work in IE
        }
        catch(ex) {
          to_sel.add(elOptNew); // IE only
        }
    }

    /* sort elements of to field */
    sortlist(to_sel.id);
}

/* return keys as array */
function keys(obj) {
    var k = [];
    for(key in obj) {
        k.push(key);
    }
    return k;
}

/* sort select by value */
function sortlist(id) {
    var lb = document.getElementById(id);

    if(!lb) {
        if(thruk_debug_js) { alert("ERROR: no element in sortlist() for: " + id ); }
    }

    opts  = new Object();

    for(i=0; i<lb.length; i++)  {
        opts[lb.options[i].text] = lb.options[i].value;
    }

    var sortedkeys = keys(opts).sort();

    for(i=0; i<lb.length; i++)  {
      lb.options[i].text  = sortedkeys[i];
      lb.options[i].value = opts[sortedkeys[i]];
    }
}

/* fetch all select fields and select all options when it is multiple select */
function multi_select_all(form) {
    elems = form.getElementsByTagName('select');
    for(var x = 0; x < elems.length; x++) {
        var sel = elems[x];
        if(sel.multiple == true) {
            for(var nr = 0; nr < sel.length; nr++) {
                sel.options[nr].selected = true;
            }
        }
    }
}

/* remove a bookmark */
function removeBookmark(nr) {
    var pan  = document.getElementById("bm" + nr);
    var panP = pan.parentNode;
    panP.removeChild(pan);
    delete bookmarks["bm" + nr];
}

/* check if element is not emty */
function checknonempty(id, name) {
    var elem = document.getElementById(id);
    if( elem.value == undefined || elem.value == "" ) {
        alert(name + " is a required field");
        return(false);
    }
    return(true);
}

/* hide all waiting icons */
var hide_activity_icons_timer;
function hide_activity_icons() {
    jQuery('img').each(function(i, e) {
        if(e.src.indexOf("/images/waiting.gif") > 0) {
            e.style.display = "none";
        }
    });
}

/* verify time */
var verify_id;
var verification_errors = new Object();
function verify_time(id) {
    verify_id = id;
    window.clearTimeout(verifyTimer);
    verifyTimer = window.setTimeout("verify_time_do(verify_id)", 500);
}
function verify_time_do(id) {
    var obj = document.getElementById(id);
    debug(obj.value);

    new Ajax.Request(url_prefix + 'thruk/cgi-bin/status.cgi?verify=time&time='+obj.value, {
        onSuccess: function(transport) {
            if(transport.responseJSON != null) {
                data = transport.responseJSON;
            } else {
                data = eval(transport.responseText);
            }
            if(data.verified == "false") {
                debug(data.error)
                verification_errors[id] = 1;
                obj.style.background = "#f8c4c4";
            } else {
                obj.style.background = "";
                delete verification_errors[id];
            }
        }
    });
}

/* return unescaped html string */
function unescapeHTML(html) {
    return jQuery("<div />").html(html).text();
}

/* reset table row classes */
function reset_table_row_classes(table, c1, c2) {
    var x = 1;
    jQuery('TABLE#'+table+' TR').each(function(i, row) {
        jQuery(row).removeClass(c1);
        jQuery(row).removeClass(c2);
        x++;
        var newclass = c2;
        if(x%2 == 0) {
            newclass = c1;
        }
        jQuery(row).addClass(newclass);
        jQuery(row).children().each(function(i, elem) {
            if(elem.tagName == 'TD') {
                if(jQuery(elem).hasClass(c1) || jQuery(elem).hasClass(c2)) {
                    jQuery(elem).removeClass(c1);
                    jQuery(elem).removeClass(c2);
                    jQuery(elem).addClass(newclass);
                }
            }
        });
    });
}

/* set icon src and refresh page */
function refresh_button(btn) {
    btn.src = url_prefix + 'thruk/themes/' + theme + '/images/waiting.gif';
    window.setTimeout("reloadPage()", 100);
}

/* reverse a string */
function reverse(s){
    return s.split("").reverse().join("");
}

/* set selection in text input */
function setSelectionRange(input, selectionStart, selectionEnd) {
  if (input.setSelectionRange) {
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
  }
  else if (input.createTextRange) {
    var range = input.createTextRange();
    range.collapse(true);
    range.moveEnd('character', selectionEnd);
    range.moveStart('character', selectionStart);
    range.select();
  }
}

/* set cursor position in text input */
function setCaretToPos(input, pos) {
  setSelectionRange(input, pos, pos);
}

/* generic sort function */
var sort_by = function(field, reverse, primer) {

   var key = function (x) {return primer ? primer(x[field]) : x[field]};

   return function (a,b) {
       var A = key(a), B = key(b);
       return (A < B ? -1 : (A > B ? 1 : 0)) * [1,-1][+!!reverse];
   }
}

/* make right pane visible */
function cron_change_date(id) {
    // get selected value
    type_sel = document.getElementById(id);
    var nr = type_sel.id.match(/_(\d+)$/)[1];
    type     = type_sel.options[type_sel.selectedIndex].value;
    hideElement('div_send_month_'+nr);
    hideElement('div_send_week_'+nr);
    hideElement('div_send_day_'+nr);
    showElement('div_send_'+type+'_'+nr);
}

/* remove a row */
function delete_cron_row(e) {
    var row = e;
    /* find first table row */
    while(row.parentNode != undefined && row.tagName != 'TR') { row = row.parentNode; }
    row.parentNode.deleteRow(row.rowIndex);
    return false;
}

/* remove a row */
function add_cron_row(tbl_id) {
    var tbl            = document.getElementById(tbl_id);
    var tblBody        = tbl.tBodies[0];

    /* get first table row */
    var row = tblBody.rows[0];
    var newRow = row.cloneNode(true);

    /* get highest number */
    var new_nr = 1;
    jQuery.each(tblBody.rows, function(i, r) {
        if(r.id) {
            var nr = r.id.match(/_(\d+)$/)[1];
            if(nr >= new_nr) {
                new_nr = parseInt(nr) + 1;
            }
        }
    });

    /* replace ids / names */
    replace_ids_and_names(newRow, new_nr);
    var all = newRow.getElementsByTagName('*');
    for (var i = -1, l = all.length; ++i < l;) {
        var elem = all[i];
        replace_ids_and_names(elem, new_nr);
    }

    newRow.style.display = "";

    var lastRowNr      = tblBody.rows.length - 1;
    var currentLastRow = tblBody.rows[lastRowNr];
    tblBody.insertBefore(newRow, currentLastRow);
}

/*******************************************************************************
  ,ad8888ba,  88b           d88 88888888ba,
 d8"'    `"8b 888b         d888 88      `"8b
d8'           88`8b       d8'88 88        `8b
88            88 `8b     d8' 88 88         88
88            88  `8b   d8'  88 88         88
Y8,           88   `8b d8'   88 88         8P
 Y8a.    .a8P 88    `888'    88 88      .a8P
  `"Y8888Y"'  88     `8'     88 88888888Y"'

 Mouse Over for Status Table
 to select hosts / services
 for sending quick commands
*******************************************************************************/
var selectedServices = new Object();
var selectedHosts    = new Object();
var noEventsForId    = new Object();
var submit_form_id;
var pagetype         = undefined;

/* add mouseover eventhandler for all cells and execute it once */
function addRowSelector(id, type) {
    var row   = document.getElementById(id);
    var cells = row.cells;

    // remove this eventhandler, it has to fire only once
    if(noEventsForId[id]) {
        return false;
    }
    if( row.detachEvent ) {
        noEventsForId[id] = 1;
    } else {
        row.onmouseover = undefined;
    }

    // reset all current highlighted rows
    jQuery('td.tableRowHover').each(function(i, e) {
        resetHostRow(e);
        resetServiceRow(e);
    });

    if(type == 'host') {
      pagetype = 'hostdetail'
    }
    else if(type == 'service') {
      pagetype = 'servicedetail'
    } else {
      if(thruk_debug_js) { alert("ERROR: unknown table addRowSelector(): " + typ); }
    }

    // for each cell in a row
    for(var cell_nr = 0; cell_nr < cells.length; cell_nr++) {
        if(pagetype == "hostdetail" || (cell_nr == 0 && cells[0].innerHTML != '')) {
            setRowStyle(id, 'tableRowHover', 'host');
            if(pagetype == 'hostdetail') {
                addEvent(cells[cell_nr], 'mouseover', set_pagetype_hostdetail);
            } else {
                addEvent(cells[cell_nr], 'mouseover', set_pagetype_servicedetail);
            }
            addEventHandler(cells[cell_nr], 'host');
        }
        else if(cell_nr >= 1) {
            addEvent(cells[cell_nr], 'mouseover', set_pagetype_servicedetail);
            setRowStyle(id, 'tableRowHover', 'service');
            addEventHandler(cells[cell_nr], 'service');
        }
    }

    // initial mouseover highlights host&service, reset class here
    if(pagetype == "servicedetail") {
        jQuery('td.tableRowHover').each(function(i, e) {
            resetHostRow(e);
        });
    }
    return true;
}

/* set right pagetype */
function set_pagetype_hostdetail() {
    pagetype = "hostdetail";
}
function set_pagetype_servicedetail() {
    pagetype = "servicedetail";
}

/* add the event handler */
function addEventHandler(elem, type) {
    if(type == 'host') {
        addEvent(elem, 'mouseover', highlightHostRow);
        addEvent(elem, 'mouseout',  resetHostRow);
        if(!elem.onclick) {
            elem.onclick = selectHost;
        }
    }
    if(type == 'service') {
        addEvent(elem, 'mouseover', highlightServiceRow);
        addEvent(elem, 'mouseout',  resetServiceRow);
        if(!elem.onclick) {
            elem.onclick = selectService;
        }
    }
}

/* add additional eventhandler to object */
function addEvent( obj, type, fn ) {
  //debug("addEvent("+obj+","+type+", ...)");
  if ( obj.attachEvent ) {
    obj['e'+type+fn] = fn;
    obj[type+fn] = function(){obj['e'+type+fn]( window.event );}
    obj.attachEvent( 'on'+type, obj[type+fn] );
  } else
    obj.addEventListener( type, fn, false );
}

/* remove an eventhandler from object */
function removeEvent( obj, type, fn ) {
  //debug("removeEvent("+obj+","+type+", ...)");
  if ( obj.detachEvent ) {
    obj.detachEvent( 'on'+type, obj[type+fn] );
    obj[type+fn] = null;
  } else
    obj.removeEventListener( type, fn, false );
}


/* returns the first element which has an id */
function getFirstParentId(elem) {
    if(!elem) {
        if(thruk_debug_js) { alert("ERROR: got no element in getFirstParentId()"); }
        return false;
    }
    nr = 0;
    while(nr < 10 && !elem.id) {
        nr++;
        if(!elem.parentNode) {
            // this may happen when looking for the parent of a event
            return false;
        }
        elem = elem.parentNode;
    }
    return elem.id;
}

/* set style for each cell */
function setRowStyle(row_id, style, type, force ) {

    var row = document.getElementById(row_id);
    if(!row) {
        if(thruk_debug_js) { alert("ERROR: got no row in setRowStyle(): " + row_id); }
        return false;
    }

    // for each cells in this row
    var cells = row.cells;
    if(!cells) {
        return false;
    }
    for(var cell_nr = 0; cell_nr < cells.length; cell_nr++) {
        // only the first cell for hosts
        // all except the first cell for services
        if((type == 'host' && pagetype == 'hostdetail') || (type == 'host' && cell_nr == 0) || (type == 'service' && cell_nr >= 1)) {
            // set style for cell itself
            styleElements(cells[cell_nr], style, force)

            // and for all row elements below
            var elems = cells[cell_nr].getElementsByTagName('TR');
            styleElements(elems, style, force)

            // and for all cell elements below
            var elems = cells[cell_nr].getElementsByTagName('TD');
            styleElements(elems, style, force)
        }
    }
    return true;
}

/* save current style and change it*/
function styleElements(elems, style, force) {
    if (elems == null || ( typeof(elems) != "object" && typeof(elems) != "function" ) || typeof(elems.length) != "number") {
        elems = new Array(elems);
    }

    if(navigator.appName == "Microsoft Internet Explorer") {
        return styleElementsIE(elems, style, force);
    }
    else {
        return styleElementsFF(elems, style, force);
    }
}

/* save current style and change it (IE only) */
function styleElementsIE(elems, style, force) {
    for(var x = 0; x < elems.length; x++) {
        if(style == 'original') {
            // reset style to original
            if(elems[x].className != "tableRowSelected" || force) {
                if(elems[x].origclass != undefined) {
                    elems[x].className = elems[x].origclass;
                }
            }
        }
        else {
            if(elems[x].className != "tableRowSelected" || force) {
                // save style in custom attribute
                if(elems[x].className != undefined && elems[x].className != "tableRowSelected" && elems[x].className != "tableRowHover") {
                    elems[x].setAttribute('origclass', elems[x].className);
                }

                // set new style
                elems[x].className = style;
            }
        }
    }
}

/* save current style and change it (non IE version) */
function styleElementsFF(elems, style, force) {
    for(var x = 0; x < elems.length; x++) {
        if(style == 'original') {
            // reset style to original
            if(elems[x].hasAttribute('origClass') && (elems[x].className == "tableRowHover" || force)) {
                elems[x].className = elems[x].origClass;
            }
        }
        else {
            if(elems[x].className != "tableRowSelected" || force) {
                // save style in custom attribute
                if(!elems[x].hasAttribute('origClass')) {
                    elems[x].setAttribute('origClass', elems[x].className);
                    elems[x].origClass = elems[x].className;
                }

                // set new style
                elems[x].className = style;
            }
        }
    }
}

/* this is the mouseover function for services */
function highlightServiceRow()
{
    // reset all current highlighted rows
    jQuery('td.tableRowHover').each(function(i, e) {
        resetHostRow(e);
        resetServiceRow(e);
    });

    // find id of current row
    var row_id = getFirstParentId(this);
    if(!row_id) {
      return;
    }
    lastRowHighlighted = row_id;
    setRowStyle(row_id, 'tableRowHover', 'service');
}

/* this is the mouseover function for hosts */
function highlightHostRow()
{
    // reset all current highlighted rows
    jQuery('td.tableRowHover').each(function(i, e) {
        resetHostRow(e);
        resetServiceRow(e);
    });

    // find id of current row
    var row_id = getFirstParentId(this);
    if(!row_id) {
      return;
    }
    lastRowHighlighted = row_id;
    setRowStyle(row_id, 'tableRowHover', 'host');
}

/* select this service */
function selectService(event, state)
{
    unselectCurrentSelection();
    var row_id;
    // find id of current row
    if(event && event.target) {
        /* ex.: FF */
        row_id = getFirstParentId(event.target);

        // dont select row when clicked on a link
        if(event.target.tagName == 'A' || event.target.tagName == 'IMG') {
            resetServiceRow(event);
            return;
        }
    }
    else if (event && (event.id || event.parentNode)) {
        row_id = getFirstParentId(event);
    }
    else {
        /* ex.: IE 7/8 */
        if(window.event.srcElement.tagName == 'A' || window.event.srcElement.tagName == 'IMG') {
            resetServiceRow(event);
            return;
        }
        row_id = getFirstParentId(this);
        event  = this;
    }
    if(!row_id) {
        return;
    }

    selectServiceByIdEvent(row_id, state, event);
    unselectCurrentSelection();
}

/* select this service */
function selectServiceByIdEvent(row_id, state, event)
{
    if(is_shift_pressed(event) && lastRowSelected != undefined) {
      no_more_events = 1;
      var id1         = parseInt(row_id.substring(5));
      var id2         = parseInt(lastRowSelected.substring(5));
      var pane_prefix = row_id.substring(0,4);

      // all selected should get the same state
      state = false;
      if(selectedServices[lastRowSelected]) {
        state = true;
      }

      // selected top down?
      if(id1 > id2) {
        var tmp = id2;
        id2 = id1;
        id1 = tmp;
      }

      for(var x = id1; x < id2; x++) {
        selectServiceByIdEvent(pane_prefix+'r'+x, state);
      }
      lastRowSelected = undefined;
      no_more_events  = 0;
    }
    else {
      lastRowSelected = row_id;
    }

    selectServiceById(row_id, state);

    checkCmdPaneVisibility();
}

/* select service row by id */
function selectServiceById(row_id, state) {
    var targetState;
    if(state != undefined) {
        targetState = state;
    }
    else if(selectedServices[row_id]) {
        targetState = false;
    }
    else {
        targetState = true;
    }

    // dont select the empty cells in services view
    row = document.getElementById(row_id);
    if(!row) {
        return false;
    }

    if(targetState) {
        setRowStyle(row_id, 'tableRowSelected', 'service', true);
        selectedServices[row_id] = 1;
    } else {
        setRowStyle(row_id, 'original', 'service', true);
        delete selectedServices[row_id];
    }
    return true;
}

/* select this host */
function selectHost(event, state)
{
    unselectCurrentSelection();

    var row_id;
    // find id of current row
    if(event && event.target) {
        /* ex.: FF */
        row_id = getFirstParentId(event.target);

        // dont select row when clicked on a link
        if(event.target.tagName == 'A' || event.target.tagName == 'IMG') {
            resetHostRow(event);
            return;
        }
    }
    else if (event && (event.id || event.parentNode)) {
        row_id = getFirstParentId(event);
    }
    else {
        /* ex.: IE 7/8 */
        if(window.event.srcElement.tagName == 'A' || window.event.srcElement.tagName == 'IMG') {
            resetHostRow(event);
            return;
        }
        row_id = getFirstParentId(this);
        event  = this;
    }
    if(!row_id) {
        return;
    }

    selectHostByIdEvent(row_id, state, event);
    unselectCurrentSelection();
}


/* select this service */
function selectHostByIdEvent(row_id, state, event) {

    if(is_shift_pressed(event) && lastRowSelected != undefined) {
      no_more_events = 1;
      var id1         = parseInt(row_id.substring(5));
      var id2         = parseInt(lastRowSelected.substring(5));
      var pane_prefix = row_id.substring(0,4);

      // all selected should get the same state
      state = false;
      if(selectedHosts[lastRowSelected]) {
        state = true;
      }

      // selected top down?
      if(id1 > id2) {
        var tmp = id2;
        id2 = id1;
        id1 = tmp;
      }

      for(var x = id1; x < id2; x++) {
        selectHostByIdEvent(pane_prefix+'r'+x, state);
      }
      lastRowSelected = undefined;
      no_more_events  = 0;
    } else {
      lastRowSelected = row_id;
    }

    selectHostById(row_id, state);

    checkCmdPaneVisibility();
}

/* set host row selected */
function selectHostById(row_id, state) {
    var targetState;
    if(state != undefined) {
        targetState = state;
    }
    else if(selectedHosts[row_id]) {
        targetState = false;
    }
    else {
        targetState = true;
    }

    // dont select the empty cells in services view
    row = document.getElementById(row_id);
    if(!row) {
      return false;
    }
    if(row.cells[0].innerHTML == "") {
      return true;
    }

    if(targetState) {
        setRowStyle(row_id, 'tableRowSelected', 'host', true);
        selectedHosts[row_id] = 1;
    } else {
        setRowStyle(row_id, 'original', 'host', true);
        delete selectedHosts[row_id];
    }
    return true;
}


/* reset row style unless it has been clicked */
function resetServiceRow(event)
{
    var row_id;
    if(!event) {
        event = this;
    }

    // find id of current row
    if(event.target) {
        row_id = getFirstParentId(event.target);
    } else {
        row_id = getFirstParentId(event);
    }
    if(!row_id) {
        if(lastRowHighlighted) {
            tmp = lastRowHighlighted;
            lastRowHighlighted = undefined;
            setRowStyle(tmp, 'original', 'service');
        }
        return;
    }
    setRowStyle(row_id, 'original', 'service');
}

/* reset row style unless it has been clicked */
function resetHostRow(event)
{
    var row_id;
    if(!event) {
        event = this;
    }
    // find id of current row
    if(event.target) {
        row_id = getFirstParentId(event.target);
    } else {
        row_id = getFirstParentId(event);
    }
    if(!row_id) {
        if(lastRowHighlighted) {
            tmp = lastRowHighlighted;
            lastRowHighlighted = undefined;
            setRowStyle(tmp, 'original', 'host');
        }
        return;
    }
    setRowStyle(row_id, 'original', 'host');
}

/* select or deselect all services */
function selectAllServices(state, pane_prefix) {
    var x = 0;
    while(selectServiceById(pane_prefix+'r'+x, state)) {
        // disable next row
        x++;
    };

    checkCmdPaneVisibility();
}
/* select services by class name */
function selectServicesByClass(classes) {
    jQuery.each(classes, function(i, classname) {
        jQuery(classname).each(function(i, obj) {
            selectService(obj, true);
        })
    });
    return false;
}

/* select hosts by class name */
function selectHostsByClass(classes) {
    jQuery.each(classes, function(i, classname) {
        jQuery(classname).each(function(i, obj) {
            selectHost(obj, true);
        })
    });
    return false;
}

/* select or deselect all hosts */
function selectAllHosts(state, pane_prefix) {
    var x = 0;
    while(selectHostById(pane_prefix+'r'+x, state)) {
        // disable next row
        x++;
    };

    checkCmdPaneVisibility();
}

/* toggle the visibility of the command pane */
function toggleCmdPane(state) {
  if(state == 1) {
    showElement('cmd_pane');
    cmdPaneState = 1;
  }
  else {
    hideElement('cmd_pane');
    cmdPaneState = 0;
  }
}

/* show command panel if there are services or hosts selected otherwise hide the panel */
function checkCmdPaneVisibility() {
    var ssize = keys(selectedServices).length;
    var hsize = keys(selectedHosts).length;
    var size  = ssize + hsize;
    if(size == 0) {
        /* hide command panel */
        toggleCmdPane(0);
    } else {
        resetRefresh();

        /* set submit button text */
        var btn = document.getElementById('multi_cmd_submit_button');
        var serviceName = "services";
        if(ssize == 1) { serviceName = "service";  }
        var hostName = "hosts";
        if(hsize == 1) { hostName = "host";  }
        var text;
        if( hsize > 0 && ssize > 0 ) {
            text = ssize + " " + serviceName + " and " + hsize + " " + hostName;
        }
        else if( hsize > 0 ) {
            text = hsize + " " + hostName;
        }
        else if( ssize > 0 ) {
            text = ssize + " " + serviceName;
        }
        btn.value = "submit command for " + text;
        check_selected_command();

        /* show command panel */
        toggleCmdPane(1);
    }
}

/* collect selected hosts and services and pack them into nice form data */
function collectFormData(form_id) {

    if(verification_errors != undefined && keys(verification_errors).length > 0) {
        alert('please enter valid data');
        return(false);
    }

    // set activity icon
    check_quick_command();

    // check form values
    var sel = document.getElementById('quick_command');
    var value = sel.value;
    if(value == 2 || value == 3 || value == 4) { /* add downtime / comment / acknowledge */
        if(document.getElementById('com_data').value == '') {
            alert('please enter a comment');
            return(false);
        }
    }

    if(value == 12) { /* submit passive result */
        if(document.getElementById('plugin_output').value == '') {
            alert('please enter a check result');
            return(false);
        }
    }

    ids_form = document.getElementById('selected_ids');
    if(ids_form) {
        // comments / downtime commands
        ids_form.value = keys(selectedHosts).join(',');
    }
    else {
        // regular services commands
        var services = new Array();
        jQuery.each(selectedServices, function(row_id, blah) {
            if(row_id.substr(0,4) == "hst_") { obj_hash = hst_Hash; }
            if(row_id.substr(0,4) == "svc_") { obj_hash = svc_Hash; }
            if(row_id.substr(0,4) == "dfl_") { obj_hash = dfl_Hash; }
            row_id = row_id.substr(4);
            services.push(obj_hash[row_id]);
        });
        service_form = document.getElementById('selected_services');
        service_form.value = services.join(',');

        var hosts = new Array();
        jQuery.each(selectedHosts, function(row_id, blah) {
            if(row_id.substr(0,4) == "hst_") { obj_hash = hst_Hash; }
            if(row_id.substr(0,4) == "svc_") { obj_hash = svc_Hash; }
            if(row_id.substr(0,4) == "dfl_") { obj_hash = dfl_Hash; }
            row_id = row_id.substr(4);
            hosts.push(obj_hash[row_id]);
        });
        host_form = document.getElementById('selected_hosts');
        host_form.value = hosts.join(',');
    }

    if(value == 1 ) { // reschedule
        var btn = document.getElementById(form_id);
        if(btn) {
            submit_form_id = form_id;
            window.setTimeout(submit_form, 100);
            return(false);
        }
    }

    return(true);
}

/* submit a form by id */
function submit_form() {
    var btn = document.getElementById(submit_form_id);
    btn.submit();
}

/* show/hide options for commands based on the selected command*/
function check_selected_command() {
    var sel = document.getElementById('quick_command');
    var value = sel.value;

    disableAllFormElement();
    if(value == 1) { /* reschedule next check */
        enableFormElement('row_start');
        enableFormElement('row_reschedule_options');
    }
    if(value == 2) { /* add downtime */
        enableFormElement('row_start');
        enableFormElement('row_end');
        enableFormElement('row_comment');
    }
    if(value == 3) { /* add comment */
        enableFormElement('row_comment');
        enableFormElement('row_comment_options');
        document.getElementById('opt_persistent').value = 'comments';
    }
    if(value == 4) { /* add acknowledgement */
        enableFormElement('row_comment');
        enableFormElement('row_ack_options');
        document.getElementById('opt_persistent').value = 'ack';
        if(has_expire_acks) {
            enableFormElement('opt_expire');
            if(document.getElementById('opt5').checked == true) {
                enableFormElement('row_expire');
            }
        }
    }
    if(value == 5) { /* remove downtimes */
        enableFormElement('row_down_options');
    }
    if(value == 6) { /* remove comments */
    }
    if(value == 7) { /* remove acknowledgement */
    }
    if(value == 8) { /* enable active checks */
    }
    if(value == 9) { /* disable active checks */
    }
    if(value == 10) { /* enable notifications */
    }
    if(value == 11) { /* disable notifications */
    }
    if(value == 12) { /* submit passive check result */
        enableFormElement('row_submit_options');
    }
}

/* hide all form element rows */
function disableAllFormElement() {
    var elems = new Array('row_start', 'row_end', 'row_comment', 'row_reschedule_options', 'row_ack_options', 'row_comment_options', 'row_submit_options', 'row_expire', 'opt_expire', 'row_down_options');
    jQuery.each(elems, function(index, id) {
        obj = document.getElementById(id);
        obj.style.display = "none";
    });
}

/* show this form row */
function enableFormElement(id) {
    obj = document.getElementById(id);
    obj.style.display = "";
}


/* verify submited command */
function check_quick_command() {
    var sel   = document.getElementById('quick_command');
    var value = sel.value;
    var img;

    // disable hide timer
    window.clearTimeout(hide_activity_icons_timer);

    if(value == 1 ) { // reschedule
        jQuery.each(selectedServices, function(row_id, blah) {
            cell           = document.getElementById(row_id + "_s_exec");
            cell.innerHTML = '';
            img            = document.createElement('img');
            img.src        = url_prefix + 'thruk/themes/' + theme + '/images/waiting.gif';
            img.height     = 20;
            img.width      = 20;
            img.title      = "This service is currently executing its servicecheck";
            img.alt        = "This service is currently executing its servicecheck";
            cell.appendChild(img);
        });
        jQuery.each(selectedHosts, function(row_id, blah) {
            cell           = document.getElementById(row_id + "_h_exec");
            cell.innerHTML = '';
            img            = document.createElement('img');
            img.src        = url_prefix + 'thruk/themes/' + theme + '/images/waiting.gif';
            img.height     = 20;
            img.width      = 20;
            img.title      = "This host is currently executing its hostcheck";
            img.alt        = "This host is currently executing its hostcheck";
            cell.appendChild(img);
        });
        var btn = document.getElementById('multi_cmd_submit_button');
        btn.value = "processing commands...";
    }

    return true;
}


/* select this service */
function toggle_comment(event) {
    if(!event) {
        event = this;
    }
    if(event && event.target) {
        // dont select row when clicked on a link
        if(event.target.tagName == 'A' || event.target.tagName == 'IMG') {
            return true;
        }
    }

    // find id of current row
    if(event.target) {
        row_id = getFirstParentId(event.target);
    } else {
        row_id = getFirstParentId(event);
    }
    if(!row_id) {
        return false;
    }

    var state = true;
    if(selectedHosts[row_id]) {
        state = false;
    }

    if(is_shift_pressed(event) && lastRowSelected != undefined) {
        no_more_events = 1;
        var id1         = parseInt(row_id.substring(4));
        var id2         = parseInt(lastRowSelected.substring(4));
        var pane_prefix = row_id.substring(0,4);

        // all selected should get the same state
        state = false;
        if(selectedHosts[lastRowSelected]) {
            state = true;
        }

        // selected top down?
        if(id1 > id2) {
            var tmp = id2;
            id2 = id1;
            id1 = tmp;
        }

        for(var x = id1; x < id2; x++) {
            if(document.getElementById(pane_prefix+x)) {
                selectCommentById(pane_prefix+x, state);
            }
        }
        lastRowSelected = undefined;
        no_more_events  = 0;
    } else {
        lastRowSelected = row_id;
    }

    selectCommentById(row_id, state);

    // check visibility of command pane
    var number = keys(selectedHosts).length;
    var text = "remove " + number + " " + type;
    if(number != 1) {
        text = text + "s";
    }
    jQuery('#quick_command')[0].options[0].text = text;
    if(number > 0) {
        showElement('cmd_pane');
    } else {
        hideElement('cmd_pane');
    }

    unselectCurrentSelection();

    return false;
}

/* toggle selection of comment on downtimes/comments page */
function selectCommentById(row_id, state) {
    var row   = document.getElementById(row_id);
    if(!row) {
        if(thruk_debug_js) { alert("ERROR: unknown id in selectCommentById(): " + row_id); }
        return;
    }
    var elems = row.getElementsByTagName('TD');

    if(state == false) {
        delete selectedHosts[row_id];
        styleElements(elems, "original", 1);
    } else {
        selectedHosts[row_id] = row_id;
        styleElements(elems, 'tableRowSelected', 1)
    }
    return false;
}

/* unselect all selections on downtimes/comments page */
function unset_comments() {
    jQuery.each(selectedHosts, function(nr, blah) {
        var row_id = selectedHosts[nr];
        var row    = document.getElementById(row_id);
        var elems  = row.getElementsByTagName('TD');
        styleElements(elems, "original", 1);
        delete selectedHosts[nr];
    });
    hideElement('cmd_pane');
}

/*******************************************************************************
88888888888  88   88     888888888888 88888888888 88888888ba
88           88   88          88      88          88      "8b
88           88   88          88      88          88      ,8P
88aaaaa      88   88          88      88aaaaa     88aaaaaa8P'
88"""""      88   88          88      88"""""     88""""88'
88           88   88          88      88          88    `8b
88           88   88          88      88          88     `8b
88           88   88888888888 88      88888888888 88      `8b

everything needed for displaying and changing filter
on status / host details page
*******************************************************************************/

/* toggle the visibility of the filter pane */
function toggleFilterPane(prefix) {
  debug("toggleFilterPane(): " + toggleFilterPane.caller);
  var pane = document.getElementById(prefix+'all_filter_table');
  var img  = document.getElementById(prefix+'filter_button');
  if(pane.style.display == 'none') {
    pane.style.display    = '';
    pane.style.visibility = 'visible';
    img.style.display     = 'none';
    img.style.visibility  = 'hidden';
    additionalParams['hidesearch'] = 2;
    document.getElementById('hidesearch').value = 2;
  }
  else {
    pane.style.display    = 'none';
    pane.style.visibility = 'hidden';
    img.style.display     = '';
    img.style.visibility  = 'visible';
    additionalParams['hidesearch'] = 1;
    document.getElementById('hidesearch').value = 1;
  }
}

/* toggle filter pane */
function toggleFilterPaneSelector(search_prefix, id) {
  var panel;
  var checkbox_name;
  var input_name;
  var checkbox_prefix;

  search_prefix = search_prefix.substring(0, 7);

  if(id == "hoststatustypes") {
    panel           = 'hoststatustypes_pane';
    checkbox_name   = 'hoststatustype';
    input_name      = 'hoststatustypes';
    checkbox_prefix = 'ht';
  }
  if(id == "hostprops") {
    panel           = 'hostprops_pane';
    checkbox_name   = 'hostprop';
    input_name      = 'hostprops';
    checkbox_prefix = 'hp';
  }
  if(id == "servicestatustypes") {
    panel           = 'servicestatustypes_pane';
    checkbox_name   = 'servicestatustype';
    input_name      = 'servicestatustypes';
    checkbox_prefix = 'st';
  }
  if(id == "serviceprops") {
    panel           = 'serviceprops_pane';
    checkbox_name   = 'serviceprop';
    input_name      = 'serviceprops';
    checkbox_prefix = 'sp';
  }

  if(!panel) {
    if(thruk_debug_js) { alert("ERROR: unknown id in toggleFilterPaneSelector(): " + search_prefix + id); }
    return;
  }
  if(!toggleElement(search_prefix+panel)) {
    accept_filter_types(search_prefix, checkbox_name, input_name, checkbox_prefix);
  } {
    set_filter_types(search_prefix, input_name, checkbox_prefix);
  }
}

/* calculate the sum for a filter */
function accept_filter_types(search_prefix, checkbox_names, result_name, checkbox_prefix) {
    var inp  = document.getElementsByName(search_prefix + result_name);
    if(!inp || inp.length == 0) {
      if(thruk_debug_js) { alert("ERROR: no element in accept_filter_types() for: " + search_prefix + result_name); }
      return;
    }
    var orig = inp[0].value;
    var sum = 0;
    jQuery("input[name="+search_prefix + checkbox_names+"]").each(function(index, elem) {
        if(elem.checked) {
            sum += parseInt(elem.value);
        }
    });
    inp[0].value = sum;

    set_filter_name(search_prefix, checkbox_names, checkbox_prefix, parseInt(sum));
}

/* set the initial state of filter checkboxes */
function set_filter_types(search_prefix, initial_id, checkbox_prefix) {
    var inp = document.getElementsByName(search_prefix + initial_id);
    if(!inp || inp.length == 0) {
      if(thruk_debug_js) { alert("ERROR: no element in set_filter_types() for: " + search_prefix + initial_id); }
      return;
    }
    var initial_value = parseInt(inp[0].value);
    var bin  = initial_value.toString(2);
    var bits = new Array(); bits = bin.split('').reverse();
    for (var index = 0, len = bits.length; index < len; ++index) {
        var bit = bits[index];
        var nr  = Math.pow(2, index);
        var checkbox = document.getElementById(search_prefix + checkbox_prefix + nr);
        if(!checkbox) {
          if(thruk_debug_js) { alert("ERROR: got no checkbox for id in set_filter_types(): " + search_prefix + checkbox_prefix + nr); }
          return;
        }
        if(bit == '1') {
            checkbox.checked = true;
        } else {
            checkbox.checked = false;
        }
    }
}

/* set the filtername */
function set_filter_name(search_prefix, checkbox_names, checkbox_prefix, filtervalue) {
  var order;
  if(checkbox_prefix == 'ht') {
    order = hoststatustypes;
  }
  else if(checkbox_prefix == 'hp') {
    order = hostprops;
  }
  else if(checkbox_prefix == 'st') {
    order = servicestatustypes;
  }
  else if(checkbox_prefix == 'sp') {
    order = serviceprops;
  }
  else {
    if(thruk_debug_js) { alert('ERROR: unknown prefix in set_filter_name(): ' + checkbox_prefix); }
  }

  var checked_ones = new Array();
  jQuery.each(order, function(index, bit) {
    checkbox = document.getElementById(search_prefix + checkbox_prefix + bit);
    if(!checkbox) {
        if(thruk_debug_js) { alert('ERROR: got no checkbox in set_filter_name(): ' + search_prefix + checkbox_prefix + bit); }
    }
    if(checkbox.checked) {
      nameElem = document.getElementById(search_prefix + checkbox_prefix + bit + 'n');
      if(!nameElem) {
        if(thruk_debug_js) { alert('ERROR: got no element in set_filter_name(): ' + search_prefix + checkbox_prefix + bit + 'n'); }
      }
      checked_ones.push(nameElem.innerHTML);
    }
  });

  /* some override names */
  if(checkbox_prefix == 'ht') {
    filtername = checked_ones.join(' | ');
    if(filtervalue == 0 || filtervalue == 15) {
      filtername = 'All';
    }
    if(filtervalue == 12) {
      filtername = 'All problems';
    }
  }

  if(checkbox_prefix == 'st') {
    filtername = checked_ones.join(' | ');
    if(filtervalue == 0 || filtervalue == 31) {
      filtername = 'All';
    }
    if(filtervalue == 28) {
      filtername = 'All problems';
    }
  }

  if(checkbox_prefix == 'hp') {
    filtername = checked_ones.join(' & ');
    if(filtervalue == 0) {
      filtername = 'Any';
    }
  }

  if(checkbox_prefix == 'sp') {
    filtername = checked_ones.join(' & ');
    if(filtervalue == 0) {
      filtername = 'Any';
    }
  }

  target = document.getElementById(search_prefix + checkbox_prefix + 'n');
  target.innerHTML = filtername;
}

/* add a new filter selector to this table */
function add_new_filter(search_prefix, table) {
  pane_prefix   = search_prefix.substring(0,4);
  search_prefix = search_prefix.substring(4);
  var index     = search_prefix.indexOf('_');
  search_prefix = search_prefix.substring(0,index+1);
  table         = table.substring(4);
  tbl           = document.getElementById(pane_prefix+search_prefix+table);
  if(!tbl) {
    if(thruk_debug_js) { alert("ERROR: got no table for id in add_new_filter(): " + pane_prefix+search_prefix+table); }
    return;
  }

  // add new row
  var tblBody        = tbl.tBodies[0];
  var currentLastRow = tblBody.rows.length - 1;
  var newRow         = tblBody.insertRow(currentLastRow);

  // get first free number of typeselects
  var nr = 0;
  for(var x = 0; x<= 99; x++) {
    tst = document.getElementById(pane_prefix + search_prefix + x + '_ts');
    if(tst) { nr = x+1; }
  }

  // add first cell
  var typeselect = document.createElement('select');
  var options    = new Array('Check Period',
                             'Comment',
                             'Contact',
                             'Current Attempt',
                             'Custom Variable',
                             'Downtime Duration',
                             'Duration',
                             'Execution Time',
                             'Host',
                             'Hostgroup',
                             'Last Check',
                             'Latency',
                             'Next Check',
                             'Notification Period',
                             'Parent',
                             'Service',
                             'Servicegroup',
                             '% State Change'
                            );
  if(enable_shinken_features) {
    options.unshift('Business Impact');
  }
  options.unshift('Search');

  typeselect.onchange   = verify_op;
  typeselect.setAttribute('name', pane_prefix + search_prefix + 'type');
  typeselect.setAttribute('id', pane_prefix + search_prefix + nr + '_ts');
  add_options(typeselect, options);

  var opselect          = document.createElement('select');
  var options           = new Array('~', '!~', '=', '!=', '<=', '>=');
  opselect.setAttribute('name', pane_prefix + search_prefix + 'op');
  opselect.setAttribute('id', pane_prefix + search_prefix + nr + '_to');
  opselect.className='filter_op_select';
  add_options(opselect, options);

  var newCell0 = newRow.insertCell(0);
  newCell0.nowrap    = "true";
  newCell0.className = "filterValueInput";
  newCell0.colSpan   = 2;
  newCell0.appendChild(typeselect);

  var newInputPre    = document.createElement('input');
  newInputPre.type      = 'text';
  newInputPre.value     = '';
  newInputPre.className = 'filter_pre_value';
  newInputPre.setAttribute('name', pane_prefix + search_prefix + 'val_pre');
  newInputPre.setAttribute('id',   pane_prefix + search_prefix + nr + '_val_pre');
  newInputPre.style.display    = "none";
  newInputPre.style.visibility = "hidden";
  /*
   * not possible right now
  if(ajax_search_enabled) {
    newInputPre.onclick = function() { ajax_search.init(this, 'custom variable') };
  }
  */
  newCell0.appendChild(newInputPre);

  newCell0.appendChild(opselect);

  var newInput       = document.createElement('input');
  newInput.type      = 'text';
  newInput.value     = '';
  newInput.setAttribute('name', pane_prefix + search_prefix + 'value');
  newInput.setAttribute('id',   pane_prefix + search_prefix + nr + '_value');
  if(ajax_search_enabled) {
    newInput.onclick = ajax_search.init;
  }
  newCell0.appendChild(newInput);

  if(enable_shinken_features) {
    var newSelect      = document.createElement('select');
    newSelect.setAttribute('name', pane_prefix + search_prefix + 'value_sel');
    newSelect.setAttribute('id', pane_prefix + search_prefix + nr + '_value_sel');
    add_options(newSelect, priorities, 2);
    newSelect.style.display    = "none";
    newSelect.style.visibility = "hidden";
    newCell0.appendChild(newSelect);
  }

  var calImg = document.createElement('img');
  calImg.src = url_prefix + "thruk/themes/"+theme+"/images/calendar.png";
  calImg.className = "cal_icon";
  calImg.alt = "choose date";
  var link   = document.createElement('a');
  link.href  = "javascript:show_cal('" + pane_prefix + search_prefix + nr + "_value')";
  link.setAttribute('id', pane_prefix + search_prefix + nr + '_cal');
  link.style.display    = "none";
  link.style.visibility = "hidden";
  link.appendChild(calImg);
  newCell0.appendChild(link);

  // add second cell
  var img            = document.createElement('input');
  img.type           = 'image';
  img.src            = url_prefix + "thruk/themes/"+theme+"/images/remove.png";
  img.className      = 'filter_button';
  var newCell1       = newRow.insertCell(1);
  newCell1.onclick   = delete_filter_row;
  newCell1.className = "newfilter";
  newCell1.appendChild(img);

  // fill in values from last row
  lastnr=nr-1;
  var lastops = jQuery('#'+pane_prefix + search_prefix + lastnr + '_to');
  if(lastops.length > 0) {
      jQuery('#'+pane_prefix + search_prefix + nr + '_to')[0].selectedIndex    = jQuery('#'+pane_prefix + search_prefix + lastnr + '_to')[0].selectedIndex;
      jQuery('#'+pane_prefix + search_prefix + nr + '_ts')[0].selectedIndex    = jQuery('#'+pane_prefix + search_prefix + lastnr + '_ts')[0].selectedIndex;
      jQuery('#'+pane_prefix + search_prefix + nr + '_value')[0].value         = jQuery('#'+pane_prefix + search_prefix + lastnr + '_value')[0].value;
      jQuery('#'+pane_prefix + search_prefix + nr + '_val_pre')[0].value       = jQuery('#'+pane_prefix + search_prefix + lastnr + '_val_pre')[0].value;
  }
  verify_op(pane_prefix + search_prefix + nr + '_ts');
}

/* remove a row */
function delete_filter_row(event) {
  var row;
  if(event && event.target) {
    row = event.target;
  } else if(event) {
    row = event;
  } else {
    row = this;
  }
  /* find first table row */
  while(row.parentNode != undefined && row.tagName != 'TR') { row = row.parentNode; }
  row.parentNode.deleteRow(row.rowIndex);
  return false;
}

/* add options to a select
 * numbered:
 *   undef = value is lowercase text
 *   1     = value is numbered starting at 0
 *   2     = value is revese numbered
 */
function add_options(select, options, numbered) {
    var x = 0;
    if(numbered == 2) { x = options.length; }
    jQuery.each(options, function(index, text) {
        var opt  = document.createElement('option');
        opt.text = text;
        if(numbered) {
            opt.value = x;
        } else {
            opt.value = text.toLowerCase();
        }
        select.options[select.options.length] = opt;
        if(numbered == 2) {
            x--;
        } else {
            x++;
        }
    });
}

/* create a complete new filter pane */
function new_filter(cloneObj, parentObj, btnId) {
  pane_prefix       = btnId.substring(0,4);
  btnId             = btnId.substring(4);
  var index         = btnId.indexOf('_');
  var search_prefix = btnId.substring(0, index+1);
  cloneObj          = cloneObj.substring(4);
  var origObj       = document.getElementById(pane_prefix+search_prefix+cloneObj);
  if(!origObj) {
    if(thruk_debug_js) { alert("ERROR: no elem to clone in new_filter() for: " + pane_prefix + search_prefix + cloneObj); }
  }
  var newObj   = origObj.cloneNode(true);

  var new_prefix = 's' + (parseInt(search_prefix.substring(1)) + 1) + '_';

  // replace ids and names
  var tags = new Array('A', 'INPUT', 'TABLE', 'TR', 'TD', 'SELECT', 'INPUT', 'DIV', 'IMG');
  jQuery.each(tags, function(i, tag) {
      var elems = newObj.getElementsByTagName(tag);
      replaceIdAndNames(elems, pane_prefix+new_prefix);
  });

  // replace id of panel itself
  replaceIdAndNames(newObj, pane_prefix+new_prefix);

  var tblObj   = document.getElementById(parentObj);
  var tblBody  = tblObj.tBodies[0];
  var nextCell = tblBody.rows[0].cells.length;
  var newCell  = tblBody.rows[0].insertCell(nextCell);
  newCell.setAttribute('valign', 'top');
  newCell.appendChild(newObj);

  // hide the original button
  hideElement(pane_prefix + btnId);
  hideBtn = document.getElementById(pane_prefix+new_prefix + 'filter_button_mini');
  if(hideBtn) { hideElement( hideBtn); }
  hideElement(pane_prefix + new_prefix + 'btn_accept_search');
  showElement(pane_prefix + new_prefix + 'btn_del_search');

  hideBtn = document.getElementById(pane_prefix + new_prefix + 'filter_title');
  if(hideBtn) { hideElement(hideBtn); }

  styler = document.getElementById(pane_prefix + new_prefix + 'style_selector');
  if(styler) { styler.parentNode.removeChild(styler); }
}

/* replace ids and names for elements */
function replaceIdAndNames(elems, new_prefix) {
  if (elems == null || ( typeof(elems) != "object" && typeof(elems) != "function" ) || typeof(elems.length) != "number") {
    elems = new Array(elems);
  }
  for(var x = 0; x < elems.length; x++) {
    var elem = elems[x];
    if(elem.id) {
        var new_id = elem.id.replace(/^\w{3}_s\d+_/, new_prefix);
        elem.setAttribute('id', new_id);
    }
    if(elem.name) {
        var new_name = elem.name.replace(/^\w{3}_s\d+_/, new_prefix);
        elem.setAttribute('name', new_name);
    }

    if(ajax_search_enabled && elem.tagName == 'INPUT' && elem.type == 'text') {
      elem.onclick = ajax_search.init;
    }
  };
}

/* replace id and name of a object */
function replace_ids_and_names(elem, new_nr) {
    if(elem.id) {
        var new_id = elem.id.replace(/_\d+$/, '_'+new_nr);
        elem.setAttribute('id', new_id);
    }
    if(elem.name) {
        var new_name = elem.name.replace(/_\d+$/, '_'+new_nr);
        elem.setAttribute('name', new_name);
    }
    return elem
}

/* remove a search panel */
function deleteSearchPane(id) {
  pane_prefix   = id.substring(0,4);
  id            = id.substring(4);
  var index     = id.indexOf('_');
  search_prefix = id.substring(0,index+1);

  var pane = document.getElementById(pane_prefix + search_prefix + 'filter_pane');
  var cell = pane.parentNode;
  while(cell.firstChild) {
      child = cell.firstChild;
      cell.removeChild(child);
  }

  // show last "new search" button
  var last_nr = 0;
  for(var x = 0; x<= 99; x++) {
      tst = document.getElementById(pane_prefix + 's'+x+'_' + 'new_filter');
      if(tst && pane_prefix + 's'+x+'_' != search_prefix) { last_nr = x; }
  }
  showElement( pane_prefix + 's'+last_nr+'_' + 'new_filter');

  return false;
}

/* toogle checkbox for attribute filter */
function toggleFilterCheckBox(id) {
  id  = id.substring(0, id.length -1);
  var box = document.getElementById(id);
  if(box.checked) {
    box.checked = false;
  } else {
    box.checked = true;
  }
}

/* verify operator for search type selects */
function verify_op(event) {
  var selElem;
  if(event && event.target) {
    selElem = event.target;
  } else if(event) {
    selElem = document.getElementById(event);
  } else {
    selElem = document.getElementById(this.id);
  }

  // get operator select
  var opElem = document.getElementById(selElem.id.substring(0, selElem.id.length - 1) + 'o');

  var selValue = selElem.options[selElem.selectedIndex].value;

  // do we have to display the datepicker?
  var calElem = document.getElementById(selElem.id.substring(0, selElem.id.length - 2) + 'cal');
  if(selValue == 'next check' || selValue == 'last check' ) {
    showElement(calElem);
  } else {
    hideElement(calElem);
  }

  var input  = document.getElementById(selElem.id.substring(0, selElem.id.length - 2) + 'value');
  if(enable_shinken_features) {
    var select = document.getElementById(selElem.id.substring(0, selElem.id.length - 2) + 'value_sel');
    if(selValue == 'business impact' ) {
      showElement(select.id);
      hideElement(input.id);
    } else {
      hideElement(select.id);
      showElement(input.id);
    }
  }
  var pre_in = document.getElementById(selElem.id.substring(0, selElem.id.length - 2) + 'val_pre');
  if(selValue == 'custom variable' ) {
    showElement(pre_in.id);
    jQuery(input).css('width', '80px');
  } else {
    hideElement(pre_in.id);
    jQuery(input).css('width', '');
  }

  // check if the right operator are active
  for(var x = 0; x< opElem.options.length; x++) {
    var curOp = opElem.options[x].value;
    if(curOp == '~' || curOp == '!~') {
      // list of fields which have a ~ or !~ operator
      if(   selValue != 'search'
         && selValue != 'host'
         && selValue != 'service'
         && selValue != 'hostgroup'
         && selValue != 'servicegroup'
         && selValue != 'timeperiod'
         && selValue != 'custom variable'
         && selValue != 'comment') {
        // is this currently selected?
        if(x == opElem.selectedIndex) {
          // only = and != are allowed for list searches
          // so set the corresponding one
          if(curOp == '!~') {
              selectByValue(opElem, '!=');
          } else {
              selectByValue(opElem, '=');
          }
        }
        opElem.options[x].style.display = "none";
        opElem.options[x].disabled      = true;
      } else {
        opElem.options[x].style.display = "";
        opElem.options[x].disabled      = false;
      }
    }

    // list of fields which have a <= or >= operator
    if(curOp == '<=' || curOp == '>=') {
      if(   selValue != 'next check'
         && selValue != 'last check'
         && selValue != 'latency'
         && selValue != 'current attempt'
         && selValue != 'execution time'
         && selValue != '% state change'
         && selValue != 'duration'
         && selValue != 'downtime duration'
         && selValue != 'business impact') {
        // is this currently selected?
        if(x == opElem.selectedIndex) {
          // only <= and >= are allowed for list searches
          selectByValue(opElem, '=');
        }
        opElem.options[x].style.display = "none";
        opElem.options[x].disabled      = true;
      } else {
        opElem.options[x].style.display = "";
        opElem.options[x].disabled      = false;
      }
    }
  }
}

/* select option from a select by value*/
function selectByValue(select, val) {
  for(var x = 0; x< select.options.length; x++) {
    if(select.options[x].value == val) {
      select.selectedIndex = x;
    } else {
      select.options[x].selected = false;
    }
  }
}

/* toggle visibility of top status informations */
function toggleTopPane() {
  var formInput = document.getElementById('hidetop');
  if(toggleElement('top_pane')) {
    additionalParams['hidetop'] = 0;
    formInput.value = 0;
    document.getElementById('btn_toggle_top_pane').src = url_prefix + "thruk/themes/" + theme + "/images/icon_minimize.gif";
  } else {
    additionalParams['hidetop'] = 1;
    formInput.value = 1;
    document.getElementById('btn_toggle_top_pane').src = url_prefix + "thruk/themes/" + theme + "/images/icon_maximize.gif";
  }
}

/*******************************************************************************
  ,ad8888ba,        db        88
 d8"'    `"8b      d88b       88
d8'               d8'`8b      88
88               d8'  `8b     88
88              d8YaaaaY8b    88
Y8,            d8""""""""8b   88
 Y8a.    .a8P d8'        `8b  88
  `"Y8888Y"' d8'          `8b 88888888888
*******************************************************************************/

function show_cal(id) {
  debug(id);
  var dateObj   = new Date();
  var date_val  = document.getElementById(id).value;
  var date_time = date_val.split(" ");
  if(date_time.length == 2) {
    var dates     = date_time[0].split('-');
    var times     = date_time[1].split(':');
    if(times[2] == undefined) {
        times[2] = 0;
    }
    dateObj   = new Date(dates[0], (dates[1]-1), dates[2], times[0], times[1], times[2]);
  }
  else {
    times = new Array(0,0,0);
  }

  var cal = Calendar.setup({
      time: Calendar.printDate(dateObj, '%H%M'),
      date: Calendar.dateToInt(dateObj),
      showTime: true,
      fdow: 1,
      weekNumbers: true,
      onSelect: function() {
        var newDateObj = new Date(this.selection.print('%Y'), (this.selection.print('%m')-1), this.selection.print('%d'), this.getHours(), this.getMinutes(), times[2]);
        if(Calendar.printDate(newDateObj, '%S') == 0) {
            document.getElementById(id).value = Calendar.printDate(newDateObj, '%Y-%m-%d %H:%M');
        } else {
            document.getElementById(id).value = Calendar.printDate(newDateObj, '%Y-%m-%d %H:%M:%S');
        }
        this.hide();
      },
      onBlur: function() {
        var newDateObj = new Date(this.selection.print('%Y'), (this.selection.print('%m')-1), this.selection.print('%d'), this.getHours(), this.getMinutes(), times[2]);
        document.getElementById(id).value = Calendar.printDate(newDateObj, '%Y-%m-%d %H:%M:%S');
        if(Calendar.printDate(newDateObj, '%S') == 0) {
            document.getElementById(id).value = Calendar.printDate(newDateObj, '%Y-%m-%d %H:%M');
        } else {
            document.getElementById(id).value = Calendar.printDate(newDateObj, '%Y-%m-%d %H:%M:%S');
        }
      },
      onTimeChange: function(c, time) {
        time = time - time%5;
        c.setTime(time, true);
      }
  });
  cal.selection.set(Calendar.dateToInt(dateObj));
  cal.popup(id);
}

/*******************************************************************************
 ad88888ba  88888888888        db        88888888ba    ,ad8888ba,  88        88
d8"     "8b 88                d88b       88      "8b  d8"'    `"8b 88        88
Y8,         88               d8'`8b      88      ,8P d8'           88        88
`Y8aaaaa,   88aaaaa         d8'  `8b     88aaaaaa8P' 88            88aaaaaaaa88
  `"""""8b, 88"""""        d8YaaaaY8b    88""""88'   88            88""""""""88
        `8b 88            d8""""""""8b   88    `8b   Y8,           88        88
Y8a     a8P 88           d8'        `8b  88     `8b   Y8a.    .a8P 88        88
 "Y88888P"  88888888888 d8'          `8b 88      `8b   `"Y8888Y"'  88        88
*******************************************************************************/
var ajax_search = {
    url             : url_prefix + 'thruk/cgi-bin/status.cgi?format=search',
    max_results     : 12,
    input_field     : 'NavBarSearchItem',
    result_pan      : 'search-results',
    update_interval : 3600, // update at least every hour
    search_type     : 'all',
    size            : 150,

    hideTimer       : undefined,
    base            : new Array(),
    res             : new Array(),
    initialized     : false,
    initialized_t   : false,
    initialized_a   : false,
    cur_select      : -1,
    result_size     : false,
    cur_results     : false,
    cur_pattern     : false,
    timer           : false,
    striped         : false,
    autosubmit      : undefined,
    list            : false,
    templates       : 'no',
    hideempty       : false,
    emptymsg        : undefined,
    show_all        : false,
    dont_hide       : false,
    autoopen        : true,
    append_value_of : undefined,
    stop_events     : false,
    empty           : false,
    emptytxt        : '',
    emptyclass      : '',
    onselect        : undefined,
    onemptyclick    : undefined,
    filter          : undefined,

    /* initialize search
     *
     * options are {
     *   url:               url to fetch data
     *   striped:           true/false, everything after " - " is trimmed
     *   autosubmit:        true/false, submit form on select
     *   list:              true/false, string is split by , and suggested by last chunk
     *   templates:         no/templates/both, suggest templates
     *   data:              search base data
     *   hideempty:         true/false, hide results when there are no hits
     *   add_prefix:        true/false, add ho:... prefix
     *   append_value_of:   id of input field to append to the original url
     *   empty:             remove text on first access
     *   emptytxt:          text when empty
     *   emptyclass:        class when empty
     *   onselect:          run this function after selecting something
     *   onemptyclick:      when clicking on the empty button
     *   filter:            run this function as additional filter
     * }
     */
    //init: function(elem, type, url, striped, autosubmit, list, templates, data) {
    init: function(elem, type, options) {
        if(elem && elem.id) {
        } else if(this.id) {
          elem = this;
        } else {
          if(thruk_debug_js) { alert("ERROR: got no element id in ajax_search.init(): " + elem); }
          return false;
        }

        if(options == undefined) { options = {}; };

        ajax_search.input_field = elem.id;

        if(ajax_search.stop_events == true) {
            return false;
        }

        if(options.striped != undefined) {
            ajax_search.striped = options.striped;
        }
        if(options.autosubmit != undefined) {
            ajax_search.autosubmit = options.autosubmit;
        }
        if(options.list != undefined) {
            ajax_search.list = options.list;
        }
        if(options.templates != undefined) {
            ajax_search.templates = options.templates;
        } else {
            ajax_search.templates = 'no';
        }
        if(options.hideempty != undefined) {
            ajax_search.hideempty = options.hideempty;
        }
        if(options.add_prefix != undefined) {
            ajax_search.add_prefix = options.add_prefix;
        }
        ajax_search.emptymsg = 'no results found';
        if(options.emptymsg != undefined) {
            ajax_search.emptymsg = options.emptymsg;
        }

        if(options.append_value_of != undefined) {
            append_value_of = options.append_value_of;
        } else {
            append_value_of = ajax_search.append_value_of;
        }

        ajax_search.empty = false;
        if(options.empty != undefined) {
            ajax_search.empty = options.empty;
        }
        if(options.emptytxt != undefined) {
            ajax_search.emptytxt = options.emptytxt;
        }
        if(options.emptyclass != undefined) {
            ajax_search.emptyclass = options.emptyclass;
        }
        ajax_search.onselect = undefined;
        if(options.onselect != undefined) {
            ajax_search.onselect = options.onselect;
        }
        ajax_search.onemptyclick = undefined;
        if(options.onemptyclick != undefined) {
            ajax_search.onemptyclick = options.onemptyclick;
        }
        ajax_search.filter = undefined;
        if(options.filter != undefined) {
            ajax_search.filter = options.filter;
        }

        var input = document.getElementById(ajax_search.input_field);
        ajax_search.size = jQuery(input).width();
        if(ajax_search.size < 100) {
            /* minimum is 100px */
            ajax_search.size = 100;
        }

        if(ajax_search.empty == true) {
            if(input.value == ajax_search.emptytxt) {
                jQuery(input).removeClass(ajax_search.emptyclass);
                input.value = "";
            }
        }

        ajax_search.show_all = false;
        var panel = document.getElementById(ajax_search.result_pan);
        if(panel) {
            panel.style.overflowY="";
            panel.style.height="";
        }

        // set type from select
        var type_selector_id = elem.id.replace('_value', '_ts');
        var selector = document.getElementById(type_selector_id);
        ajax_search.search_type = 'all';
        addEvent(input, 'keyup', ajax_search.suggest);
        addEvent(input, 'blur',  ajax_search.hide_results);

        search_url = ajax_search.url;
        if(type != undefined) {
            ajax_search.search_type = type;
            search_url              = ajax_search.url + "&type=" + type;
        } else {
            type                    = 'all';
        }
        if(options.url != undefined) {
            search_url              = options.url;
        }

        var appended_value;
        if(append_value_of) {
            var el = document.getElementById(append_value_of);
            if(el) {
                search_url     = search_url + el.value;
                appended_value = el.value;
            } else {
                search_url     = ajax_search.url;
                appended_value = '';
            }
        }

        input.setAttribute("autocomplete", "off");
        input.blur();   // blur & focus the element, otherwise the first
        input.focus();  // click would result in the browser autocomplete

        if(selector && selector.tagName == 'SELECT') {
            var search_type = selector.options[selector.selectedIndex].value;
            if(   search_type == 'host'
               || search_type == 'hostgroup'
               || search_type == 'service'
               || search_type == 'servicegroup'
               || search_type == 'timeperiod'
            ) {
                ajax_search.search_type = search_type;
            }
            if(search_type == 'parent') {
                ajax_search.search_type = 'host';
            }
            if(search_type == 'check period') {
                ajax_search.search_type = 'timeperiod';
            }
            if(search_type == 'notification period') {
                ajax_search.search_type = 'timeperiod';
            }
            if(   search_type == 'contact'
               || search_type == 'comment'
               || search_type == 'next check'
               || search_type == 'last check'
               || search_type == 'latency'
               || search_type == 'current attempt'
               || search_type == 'execution time'
               || search_type == '% state change'
               || search_type == 'duration'
               || search_type == 'downtime duration'
               || search_type == 'custom variable'
               || search_type == 'business impact' ) {
                ajax_search.search_type = 'none';
            }
        }
        if(ajax_search.search_type == 'none') {
            removeEvent( input, 'keyup', ajax_search.suggest );
            return true;
        }

        var date = new Date;
        var now  = parseInt(date.getTime() / 1000);
        // update every hour (frames searches wont update otherwise)
        if(   ajax_search.initialized
           && now < ajax_search.initialized + ajax_search.update_interval
           && (    append_value_of == undefined && ajax_search.initialized_t == type
               || (append_value_of != undefined && ajax_search.initialized_a == appended_value )
              )
        ) {
            ajax_search.suggest();
            return false;
        }

        ajax_search.initialized   = now;
        ajax_search.initialized_t = type;
        ajax_search.initialized_a = undefined;
        if(append_value_of) {
            ajax_search.initialized_a = appended_value;
        }

        // disable autocomplete
        var tmpElem = input;
        while(tmpElem && tmpElem.parentNode) {
            tmpElem = tmpElem.parentNode;
            if(tmpElem.tagName == 'FORM') {
                tmpElem.onsubmit = ajax_search.hide_results;
                tmpElem.setAttribute("autocomplete", "off");
            }
        }

        if(options.data != undefined) {
            ajax_search.base = options.data;
            ajax_search.suggest();
        } else {

             // fill data store
            jQuery.ajax({
                url: search_url,
                success: function(data) {
                    ajax_search.base = data;
                    if(ajax_search.autoopen == true) {
                        ajax_search.suggest();
                    }
                    ajax_search.autoopen = true;
                },
                error: function() {
                    ajax_search.initialized = false;
                }
            });
        }

        addEvent(document, 'keydown', ajax_search.arrow_keys);
        addEvent(document, 'click', ajax_search.hide_results);

        return false;
    },

    /* hide the search results */
    hide_results: function(event, immediately) {
        if(ajax_search.dont_hide) { return; }
        if(event && event.target) {
        }
        else {
            event  = this;
        }
        try {
            // dont hide search result if clicked on the input field
            if(event.type != "blur" && event.target.tagName == 'INPUT') { return; }
        }
        catch(e) {
            // doesnt matter
        }

        var panel = document.getElementById(ajax_search.result_pan);
        if(!panel) { return; }
        /* delay hiding a little moment, otherwise the click
         * on the suggestion would be cancel as the panel does
         * not exist anymore
         */
        if(immediately != undefined) {
            hideElement(ajax_search.result_pan);
        }
        else if(ajax_search.cur_select == -1) {
            window.clearTimeout(ajax_search.hideTimer);
            ajax_search.hideTimer = window.setTimeout("if(ajax_search.dont_hide==false){jQuery('#"+ajax_search.result_pan+"').hide('fade', {}, 300)}", 100);
        }
    },

    /* wrapper around suggest_do() to avoid multiple running searches */
    suggest: function(evt) {
        window.clearTimeout(ajax_search.timer);
        // dont suggest on enter
        evt = (evt) ? evt : ((window.event) ? event : null);
        if(evt) {
            var keyCode = evt.keyCode;
            // dont suggest on
            if(   keyCode == 13     // enter
               || keyCode == 108    // KP enter
               || keyCode == 27     // escape
               || keyCode == 16     // shift
               || keyCode == 20     // capslock
               || keyCode == 17     // ctrl
               || keyCode == 18     // alt
               || keyCode == 91     // left windows key
               || keyCode == 92     // right windows key
               || keyCode == 33     // page up
               || keyCode == 34     // page down
               || evt.altKey == true
               || evt.ctrlKey == true
               || evt.metaKey == true
               || evt.shiftKey == true
            ) {
                return false;
            }
            // tab on keyup opens suggestions for wrong input
            if(keyCode == 9 && evt.type == "keyup") {
                return false;
            }
        }

        ajax_search.timer = window.setTimeout("ajax_search.suggest_do()", 100);
        return true;
    },

    /* search some hosts to suggest */
    suggest_do: function() {
        var input;
        var input = document.getElementById(ajax_search.input_field);
        if(!input) { return; }
        if(ajax_search.base == undefined || ajax_search.base.length == 0) { return; }

        pattern = input.value;
        if(ajax_search.list) {
            /* only use the last list element for search */
            var regex  = new RegExp(ajax_search.list, 'g');
            var range  = jQuery(input).getSelection();
            var before = pattern.substr(0, range.start);
            var after  = pattern.substr(range.start);
            var rever  = reverse(before);
            var index  = rever.search(regex);
            if(index != -1) {
                var index2  = after.search(regex);
                if(index2 != -1) {
                    pattern = reverse(rever.substr(0, index)) + after.substr(0, index2);
                } else {
                    pattern = reverse(rever.substr(0, index)) + after;
                }
            } else {
                // possible on the first elem, then we search for the first delimiter after the cursor
                var index  = pattern.search(regex);
                if(index != -1) {
                    pattern = pattern.substr(0, index);
                }
            }
        }
        if(pattern.length >= 1 || ajax_search.search_type != 'all') {

            prefix = pattern.substr(0,3);
            if(prefix == 'ho:' || prefix == 'hg:' || prefix == 'se:' || prefix == 'sg:') {
                pattern = pattern.substr(3);
            }

            // remove empty strings from pattern array
            pattern = pattern.split(" ");
            var trimmed_pattern = new Array();
            jQuery.each(pattern, function(index, sub_pattern) {
                if(sub_pattern != '') {
                    trimmed_pattern.push(sub_pattern);
                }
            });
            pattern = trimmed_pattern;
            var results = new Array();
            jQuery.each(ajax_search.base, function(index, search_type) {
                var sub_results = new Array();
                var top_hits = 0;
                if(   (ajax_search.search_type == 'all' && search_type.name != 'timeperiods')
                   || (ajax_search.search_type == 'full')
                   || (ajax_search.templates == "templates" && search_type.name == ajax_search.initialized_t + " templates")
                   || (ajax_search.templates != "templates" && ajax_search.search_type + 's' == search_type.name)
                   || (ajax_search.templates == "both" && ( search_type.name == ajax_search.initialized_t + " templates" || ajax_search.search_type + 's' == search_type.name ))
                  ) {
                  jQuery.each(search_type.data, function(index, data) {
                      result_obj = new Object({ 'name': data, 'relevance': 0 });
                      var found = 0;
                      jQuery.each(pattern, function(i, sub_pattern) {
                          var index = data.toLowerCase().indexOf(sub_pattern.toLowerCase());
                          if(index != -1) {
                              found++;
                              if(index == 0) { // perfect match, starts with pattern
                                  result_obj.relevance += 100;
                              } else {
                                  result_obj.relevance += 1;
                              }
                          }
                      });
                      // additional filter?
                      var rt = true;
                      if(ajax_search.filter != undefined) {
                          rt = ajax_search.filter(data, search_type);
                      }
                      // only if all pattern were found
                      if(rt && found == pattern.length) {
                          result_obj.display = data;
                          result_obj.sorter = (result_obj.relevance) + result_obj.name;
                          sub_results.push(result_obj);
                          if(result_obj.relevance >= 100) { top_hits++; }
                      }
                  });
                }
                if(sub_results.length > 0) {
                    sub_results.sort(sort_by('sorter', false));
                    results.push(Object({ 'name': search_type.name, 'results': sub_results, 'top_hits': top_hits }));
                }
            });

            ajax_search.cur_results = results;
            ajax_search.cur_pattern = pattern;
            ajax_search.show_results(results, pattern, ajax_search.cur_select);
        }
        else {
            ajax_search.hide_results();
        }
    },

    /* present the results */
    show_results: function(results, pattern, selected) {
        var panel = document.getElementById(ajax_search.result_pan);
        var input = document.getElementById(ajax_search.input_field);
        if(!panel) { return; }

        results.sort(sort_by('top_hits', false));

        var resultHTML = '<ul>';
        var x = 0;
        var results_per_type = Math.ceil(ajax_search.max_results / results.length);
        ajax_search.res   = new Array();
        var has_more = 0;
        jQuery.each(results, function(index, type) {
            var cur_count = 0;
            var name = type.name.substring(0,1).toUpperCase() + type.name.substring(1);
            if(type.results.length == 1) { name = name.substring(0, name.length -1); }
            resultHTML += '<li><b><i>' + ( type.results.length ) + ' ' + name + '<\/i><\/b><\/li>';
            jQuery.each(type.results, function(index, data) {
                if(ajax_search.show_all || cur_count <= results_per_type) {
                    var name = data.display;
                    jQuery.each(pattern, function(index, sub_pattern) {
                        name = name.toLowerCase().replace(sub_pattern.toLowerCase(), "<b>" + sub_pattern + "<\/b>");
                    });
                    var classname = "item";
                    if(selected != -1 && selected == x) {
                        classname = "item ajax_search_selected";
                    }
                    var prefix = '';
                    if(ajax_search.search_type == "all" || ajax_search.search_type == "full" || ajax_search.add_prefix == true) {
                        if(type.name == 'hosts')             { prefix = 'ho:'; }
                        if(type.name == 'host templates')    { prefix = 'ht:'; }
                        if(type.name == 'hostgroups')        { prefix = 'hg:'; }
                        if(type.name == 'services')          { prefix = 'se:'; }
                        if(type.name == 'service templates') { prefix = 'st:'; }
                        if(type.name == 'servicegroups')     { prefix = 'sg:'; }
                    }
                    var id = "suggest_item_"+x
                    if(type.name == 'icons') {
                        file = data.display.split(" - ");
                        name = "<img src='" + file[1] + "' style='vertical-align: text-bottom'> " + file[0];
                    }
                    resultHTML += '<li><a href="" class="' + classname + '" style="width:'+ajax_search.size+'px;" id="'+id+'" rev="' + prefix+data.display +'" onclick="ajax_search.set_result(this.rev); return false;" title="' + data.display + '"> ' + name +'<\/a><\/li>';
                    ajax_search.res[x] = prefix+data.display;
                    x++;
                    cur_count++;
                } else {
                    has_more = 1;
                }
            });
        });
        if(has_more == 1) {
            var id = "suggest_item_"+x
            var classname = "item";
            if(selected != -1 && selected == x) {
                classname = "item ajax_search_selected";
            }
            resultHTML += '<li> <a href="" class="' + classname + '" style="width:'+ajax_search.size+'px;" id="'+id+'" rev="more" onmousedown="ajax_search.set_result(this.rev); return false;"><b>more...<\/b><\/a><\/li>';
            x++;
        }
        ajax_search.result_size = x;
        resultHTML += '<\/ul>';
        if(results.length == 0) {
            resultHTML += '<a href="#" onclick="ajax_search.onempty()">'+ ajax_search.emptymsg +'</a>';
            if(ajax_search.hideempty) {
                ajax_search.hide_results();
                return;
            }
        }

        panel.innerHTML = resultHTML;

        var style = panel.style;
        var coords    = ajax_search.get_coordinates(input);
        style.left    = coords[0] + "px";
        style.top     = (coords[1] + input.offsetHeight + 2) + "px";
        style.display = "block";
        style.width   = ( ajax_search.size -2 ) + "px";

        showElement(panel);
        ajax_search.stop_events = true;
        window.setTimeout("ajax_search.stop_events=false;", 200);
        input.focus();
    },

    onempty: function() {
        if(ajax_search.onemptyclick != undefined) {
            ajax_search.onemptyclick();
        }
    },

    /* set the value into the input field */
    set_result: function(value) {
        if(value == 'more' || (value == undefined && ajax_search.res.length == ajax_search.cur_select)) {
            window.clearTimeout(ajax_search.hideTimer);
            ajax_search.dont_hide=true;
            window.setTimeout("ajax_search.dont_hide=false", 500);
            var panel = document.getElementById(ajax_search.result_pan);
            if(panel) {
                panel.style.overflowY="scroll";
                panel.style.height=jQuery(panel).height()+"px";
            }
            ajax_search.show_all = true;
            ajax_search.show_results(ajax_search.cur_results, ajax_search.cur_pattern, ajax_search.cur_select);
            window.clearTimeout(ajax_search.hideTimer);
            return true;
        }

        if(ajax_search.striped && value != undefined) {
            var values = value.split(" - ", 2);
            value = values[0];
        }

        var input   = document.getElementById(ajax_search.input_field);

        var cursorpos = undefined;
        if(ajax_search.list) {
            var pattern = input.value;
            var regex   = new RegExp(ajax_search.list, 'g');
            var range   = jQuery(input).getSelection();
            var before  = pattern.substr(0, range.start);
            var after   = pattern.substr(range.start);
            var rever   = reverse(before);
            var index   = rever.search(regex);
            if(index != -1) {
                before    = before.substr(0, before.length - index);
                cursorpos = before.length + value.length;
                value     = before + value + after;
            } else {
                // possible on the first elem, then we just add everything after the first delimiter
                var index  = pattern.search(regex);
                if(index != -1) {
                    cursorpos = value.length;
                    value     = value + pattern.substr(index);
                }
            }
        }

        input.value = value;
        ajax_search.cur_select = -1;
        ajax_search.hide_results();
        input.focus();
        if(cursorpos) {
            setCaretToPos(input, cursorpos);
        }

        if(ajax_search.onselect != undefined) {
            return ajax_search.onselect();
        }

        if(( ajax_search.autosubmit == undefined
             && (
                    ajax_search.input_field == "NavBarSearchItem"
                 || ajax_search.input_field == "data.username"
                 || ajax_search.input_field == "data.name"
                 )
           )
           || ajax_search.autosubmit == true
           ) {
            var tmpElem = input;
            while(tmpElem && tmpElem.parentNode) {
                tmpElem = tmpElem.parentNode;
                if(tmpElem.tagName == 'FORM') {
                    tmpElem.submit();
                    return false;
                }
            }
            return false;
        } else {
            return false;
        }
    },

    /* eventhandler for arrow keys */
    arrow_keys: function(evt) {
        evt              = (evt) ? evt : ((window.event) ? event : null);
        if(!evt) { return false; }
        var input        = document.getElementById(ajax_search.input_field);
        var panel        = document.getElementById(ajax_search.result_pan);
        var focus        = false;
        var keyCode      = evt.keyCode;
        var navigateUp   = keyCode == 38;
        var navigateDown = keyCode == 40;

        // arrow keys
        if((!evt.ctrlKey && !evt.metaKey) && panel.style.display != 'none' && (navigateUp || navigateDown)) {
            if(navigateDown && ajax_search.cur_select == -1) {
                ajax_search.cur_select = 0;
                focus = true;
            }
            else if(navigateUp && ajax_search.cur_select == -1) {
                ajax_search.cur_select = ajax_search.result_size - 1;
                focus = true;
            }
            else if(navigateDown) {
                if(ajax_search.result_size > ajax_search.cur_select + 1) {
                    ajax_search.cur_select++;
                    focus = true;
                } else {
                    ajax_search.cur_select = -1;
                    input.focus();
                }
            }
            else if(navigateUp) {
                ajax_search.cur_select--;
                if(ajax_search.cur_select < 0) {
                    ajax_search.cur_select = -1;
                    input.focus();
                }
                else {
                    focus = true;
                }
            }
            ajax_search.show_results(ajax_search.cur_results, ajax_search.cur_pattern, ajax_search.cur_select);
            if(focus) {
                var el = document.getElementById('suggest_item_'+ajax_search.cur_select);
                if(el) {
                    el.focus();
                }
            }
            evt.preventDefault();
            return false;
        }
        // return or enter
        if(keyCode == 13 || keyCode == 108) {
            if(ajax_search.cur_select == -1) {
                return true
            }
            if(ajax_search.set_result(ajax_search.res[ajax_search.cur_select])) {
                return false;
            }
            evt.preventDefault();
            return false
        }
        // hit escape
        if(keyCode == 27) {
            ajax_search.hide_results(undefined, true);
            evt.preventDefault();
            return false;
        }
        return true;
    },

    /* return coordinates for given element */
    get_coordinates: function(element) {
        var offsetLeft = 0;
        var offsetTop = 0;
        while(element.offsetParent){
            offsetLeft += element.offsetLeft;
            offsetTop += element.offsetTop;
            if(element.scrollTop > 0){
                offsetTop -= element.scrollTop;
            }
            element = element.offsetParent;
        }
        return [offsetLeft, offsetTop];
    },

    reset: function() {
        if(ajax_search.empty) {
            var input = document.getElementById(ajax_search.input_field);
            jQuery(input).addClass(ajax_search.emptyclass);
            jQuery(input).val(ajax_search.emptytxt);
        }
    }
}

/*******************************************************************************
88888888ba  888b      88 88888888ba
88      "8b 8888b     88 88      "8b
88      ,8P 88 `8b    88 88      ,8P
88aaaaaa8P' 88  `8b   88 88aaaaaa8P'
88""""""'   88   `8b  88 88""""""'
88          88    `8b 88 88
88          88     `8888 88
88          88      `888 88
*******************************************************************************/

function set_png_img(start, end, id) {
    var newUrl = pnp_url + "&start=" + start + "&end=" + end;
    debug(newUrl);

    jQuery('#pnpwaitimg').css('display', 'block');
    jQuery('#pnpimg').attr('src', newUrl);

    jQuery('#pnpimg').load(function() {
      jQuery('#pnpimg').css('display' , 'block');
      jQuery('#pnpwaitimg').css('display', 'none');
    });

    // set style of buttons
    if(id) {
        for(x=1;x<=5;x++) {
            obj = document.getElementById("pnp_th"+x);
            styleElements(obj, "original", 1);
        }
        obj = document.getElementById(id);
        styleElements(obj, "commentEven pnpSelected", 1);
    } else {
        // get id from hash
        if(window.location.hash != '#') {
            var values = window.location.hash.split("/");
            if(values[0]) {
                id = values[0].replace(/^#/, '');
            }
        }
    }

    if(id) {
        window.location.hash = "#" + id + "/" + start + "/" + end;
    }

    // reset reload timer for page
    resetRefresh();

    return false;
}

function move_png_img(factor) {
    var urlArgs = new Object(toQueryParams(jQuery('#pnpimg').attr('src')));

    start = urlArgs["start"];
    end   = urlArgs["end"];
    diff  = end - start;

    start = parseInt(diff * factor) + parseInt(start);
    end   = parseInt(diff * factor) + parseInt(end);
    debug(start);
    debug(end);

    return set_png_img(start, end);
}

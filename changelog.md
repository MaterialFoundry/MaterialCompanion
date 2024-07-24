# Changelog Material Companion
### v1.0.4 - 24-07-2024

Additions:
<ul>
<li>Added support for Material Keys</li>
<li>Added settings to hide tabs for unused modules</li>
</ul>

### v1.0.3 - 17-02-2024

Additions:
<ul>
<li>Material Plane DIY sensors can now be updated and configured using Material Companion</li>
<li>Material Plane hardware variants are no longer hard-coded but based on GitHub releases</li>
<li>Added option to filter firmware and webserver pre-releases for the Material Plane sensor</li>
<li>Added option to update the Material Plane sensor over WiFi</li>
</ul>

Fixes:
<ul>
<li>Removed packaged pymcuprog that would give virus warnign messages and wasn't used anymore</li>
<li>'Run in Tray' option now works</li>
</ul>

### v1.0.2 - 19-10-2023
Fixes:
<ul>
<li>Fixed communication from Material Plane module to sensor</li>
<li>Python install is now checked when trying to update the sensor</li>
</ul>

Additions:
<ul>
<li>Added support for Material Deck</li>
<li>Added a 'Connection' tab for Material Plane through which the connection to the sensor can be configured</li>
<li>Added more debug info</li>
</ul>

### v1.0.1 - 04-10-2023
Additions:
<ul>
<li>Material Companion can now be used to bridge the connection between Foundry and the sensor. Mainly useful for secured Foundry servers</li>
<li>Added some additional error messages when reading hardware configs goes wrong</li>
</ul>

Fixes:
<ul>
<li>Trying to read or write data to hardware would throw an error</li>
</ul>

### v1.0.0 - 29-09-2023
<ul>
<li>Initial release, currently only functional for updating and configuring the Material Plane production hardware</li>
</ul>
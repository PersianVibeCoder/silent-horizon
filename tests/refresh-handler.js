// Run the shipped handler with a controllable service and clock.
const NativeGLib = imports.gi.GLib;
const source = imports.byteArray.toString(NativeGLib.file_get_contents(ARGV[0])[1]);
const start = source.indexOf(' a._refreshCard=function()');
const end = source.indexOf(' a._rightSelect=', start);
let now = 2000000, writes = 0, starts = 0, stops = 0, ticks = 0, fail = false, pending;
const GLib = {get_monotonic_time: () => now, PRIORITY_DEFAULT: 0};
const stream = {
    write_all_async(bytes, priority, cancel, callback) {writes++; pending = () => callback(this, {});},
    write_all_finish() {if (fail) throw Error('Broken pipe'); return [true, 1];},
};
const proc = {get_stdin_pipe: () => stream};
const a = {_state: {weatherExpanded: false}, _process: proc,
    _startService() {starts++;}, _stopService() {stops++;},
    _tick() {ticks++;}, _area: {queue_repaint() {}}};
eval(source.slice(start, end));
function check(value, message) {if (!value) throw Error(message);}
for (let i = 0; i < 20; i++) a._refreshCard();
check(writes === 1 && ticks === 1, 'Rapid clicks must coalesce');
check(a._state.weatherExpanded === false, 'Refresh must preserve collapsed state');
pending();
now += 2000000; a._state.weatherExpanded = true; a._refreshCard();
check(writes === 2 && a._state.weatherExpanded, 'Later refresh and expanded state');
fail = true; pending();
check(starts === 1 && stops === 1, 'Broken pipe must restart the service');
now += 2000000; a._refreshCard(); a._process = {}; pending();
check(starts === 1, 'Old service callback must not replace a new service');
a._disposed = true; now += 2000000; a._refreshCard();
check(writes === 3, 'Disposed widgets must ignore refresh');
print('Refresh debounce, state preservation, pipe recovery and stale callbacks passed.');

/** Class to test ambiguous naming convention of class and state. */
class StateTest;

function StateIgnore();
function StateInit();

auto state() StateTest {
	ignores StateIgnore;

	function StateInit() {
		StateIgnore();
	}

	function StateFunc() {
		StateIgnore();
	}
}

simulated state StateBegin extends StateTest {

}

simulated state StateEnd extends StateTest {

}
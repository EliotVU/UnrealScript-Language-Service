class StateExtendTest extends StateTest;

// Should override "state StateTest.StateTest"
state StateTest {
	function StateInit() {
		global.StateIgnore();
		super.StateInit();

		super(StateTest).StateInit();
	}

	// Expected to override StateFunc of the overriden state.
	function StateFunc() {

	}
}

state StateBegin {
	function StateFunc() {
		super.StateFunc();
	}
}

state StateEnd {
	function StateFunc() {
		super.StateFunc();
	}
}
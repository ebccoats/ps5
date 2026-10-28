
// res://js/test.js

class MyTestClass {
    constructor() {
        console.log("Test class initialized inside the browser!");
    }
    
    testMethod() {
        return "Hello from inside the JS file!";
    }
}

// Bind it directly to the window context so Godot can see it
window.MyTestClass = MyTestClass;

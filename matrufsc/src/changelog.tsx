/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import Changelog from "./components/changelog/Changelog.tsx";

render(() => <Changelog />, document.getElementById("root")!);

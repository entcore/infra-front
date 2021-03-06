



const whiteListAttributes = [
    // Exercizer
    "zone-id",
    // W3C
    "accept",
    "accept-charset",
    "accesskey",
    "action",
    "align",
    "alt",
    "async",
    "autocomplete",
    "autofocus",
    "autoplay",
    "bgcolor",
    "border",
    "charset",
    "checked",
    "cite",
    "class",
    "color",
    "cols",
    "colspan",
    "content",
    "contenteditable",
    "controls",
    "controlslist",
    "coords",
    "data",
    "datetime",
    "default",
    "defer",
    "dir",
    "dirname",
    "disabled",
    "download",
    "draggable",
    "dropzone",
    "enctype",
    "for",
    "form",
    "formaction",
    "headers",
    "height",
    "hidden",
    "high",
    "href",
    "hreflang",
    "http-equiv",
    "id",
    "ismap",
    "kind",
    "label",
    "lang",
    "list",
    "loop",
    "low",
    "max",
    "maxlength",
    "media",
    "method",
    "min",
    "multiple",
    "muted",
    "name",
    "novalidate",
    "open",
    "optimum",
    "pattern",
    "placeholder",
    "poster",
    "preload",
    "readonly",
    "rel",
    "required",
    "reversed",
    "rows",
    "rowspan",
    "sandbox",
    "scope",
    "selected",
    "shape",
    "size",
    "sizes",
    "span",
    "spellcheck",
    "src",
    "srcdoc",
    "srclang",
    "srcset",
    "start",
    "step",
    "style",
    "tabindex",
    "target",
    "title",
    "translate",
    "type",
    "usemap",
    "value",
    "width",
    "wrap"
];

// TODO Better be a regexp array but i have no time to implement it now.
const whiteListAttributesStartingBy = [
	"aria-",
	"data-"
];

export function getEditorWhiteListAttributes(){
    return whiteListAttributes;
}

export function getEditorWhiteListAttributesStartingBy(){
	return whiteListAttributesStartingBy;
}
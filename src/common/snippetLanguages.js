const SNIPPET_LANGUAGE_OPTIONS = [
  { key: "powershell", text: "PowerShell", fileExt: "ps1" },
  { key: "python", text: "Python", fileExt: "py" },
  { key: "c#", text: "C#", fileExt: "cs" },
  { key: "javascript", text: "JavaScript", fileExt: "js" },
  { key: "java", text: "Java", fileExt: "java" },
  { key: "objective-c", text: "Objective-C", fileExt: "c" },
  { key: "go", text: "Go", fileExt: "go" },
];

const getSnippetLanguageOption = (snippetLanguage = "powershell") =>
  SNIPPET_LANGUAGE_OPTIONS.find((option) => option.key === snippetLanguage) ||
  SNIPPET_LANGUAGE_OPTIONS[0];

export { SNIPPET_LANGUAGE_OPTIONS, getSnippetLanguageOption };

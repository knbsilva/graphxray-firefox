jest.mock("../extensionApi.js", () => ({
  downloadFile: jest.fn(),
}));

jest.mock("../security.js", () => {
  const actual = jest.requireActual("../security.js");
  return {
    ...actual,
    warnLog: jest.fn(),
  };
});

import { downloadFile } from "../extensionApi.js";
import { downloadContentAsFile } from "../session.js";

describe("downloadContentAsFile", () => {
  const testFileName =
    "graphxray-session-script-powershell-redacted-20260410T120000000Z.txt";
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    jest.useFakeTimers();
    downloadFile.mockReset();
    URL.createObjectURL = jest.fn(() => "blob:graphxray-test");
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("does not fall back to anchor download when the save dialog is cancelled", async () => {
    downloadFile.mockResolvedValue({
      status: "cancelled",
      downloadId: null,
    });

    const appendChildSpy = jest.spyOn(document.body, "appendChild");
    const removeChildSpy = jest.spyOn(document.body, "removeChild");
    const createElementSpy = jest.spyOn(document, "createElement");

    const result = await downloadContentAsFile(
      "sensitive content",
      testFileName,
      "text/plain"
    );

    jest.runAllTimers();

    expect(result).toEqual({ status: "cancelled" });
    expect(downloadFile).toHaveBeenCalledWith({
      url: "blob:graphxray-test",
      filename: testFileName,
      saveAs: true,
    });
    expect(createElementSpy).not.toHaveBeenCalledWith("a");
    expect(appendChildSpy).not.toHaveBeenCalled();
    expect(removeChildSpy).not.toHaveBeenCalled();

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it("falls back to anchor download when the downloads API is unsupported", async () => {
    downloadFile.mockResolvedValue({
      status: "unsupported",
      downloadId: null,
    });

    const anchor = originalCreateElement("a");
    anchor.click = jest.fn();
    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation((tagName) => {
        if (tagName === "a") {
          return anchor;
        }

        return originalCreateElement(tagName);
      });
    const appendChildSpy = jest.spyOn(document.body, "appendChild");
    const removeChildSpy = jest.spyOn(document.body, "removeChild");

    const result = await downloadContentAsFile(
      "sensitive content",
      testFileName,
      "text/plain"
    );

    jest.runAllTimers();

    expect(result).toEqual({ status: "saved" });
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.href).toBe("blob:graphxray-test");
    expect(anchor.download).toBe(testFileName);
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});

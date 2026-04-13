function createResponseMock() {
  const res = {
    statusCode: 200,
    view: null,
    viewData: null,
    redirectUrl: null,
    jsonBody: null,
    cookieCalls: [],
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view, data) {
      this.view = view;
      this.viewData = data;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      return this;
    },
    cookie(name, value, options) {
      this.cookieCalls.push({ name, value, options });
      return this;
    },
    clearCookie(name) {
      this.clearedCookies.push(name);
      return this;
    }
  };

  return res;
}

module.exports = {
  createResponseMock
};

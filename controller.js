/* eslint-disable */
const baseController = require("controllers/base.js");
const interfaceModel = require("models/interface.js");
const projectModel = require("models/project.js");
const interfaceCatModel = require("models/interfaceCat.js");
const logModel = require("models/log.js");
const yapi = require("yapi.js");

function handleExistId(data) {
  function delArrId(arr, fn) {
    if (!Array.isArray(arr)) return;
    arr.forEach(item => {
      /* eslint no-param-reassign: ["error", { "props": false }], no-underscore-dangle:[0] */
      delete item._id;
      delete item.__v;
      delete item.uid;
      delete item.edit_uid;
      delete item.catid;
      delete item.project_id;

      if (typeof fn === "function") fn(item);
    });
  }

  delArrId(data, item => {
    delArrId(item.list, api => {
      delArrId(api.req_body_form);
      delArrId(api.req_params);
      delArrId(api.req_query);
      delArrId(api.req_headers);
      if (api.query_path && typeof api.query_path === "object") {
        delArrId(api.query_path.params);
      }
    });
  });

  return data;
}


const parser = (collections, project) => {
  const { name } = project;
  return {
    info: {
      name: name,
      description: "",
      schema:
        "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"
    },
    item: collections.map(collection => {
      const { name, desc, list } = collection;
      return {
        name: name,
        description: desc,
        item: list.map(item => parserApi(item))
      };
    }),
    // TODO: 变量动态化
    variable: [
      {
        id: "baseUrl",
        key: "baseUrl",
        value: "/",
        type: "string"
      }
    ]
  };
};
const parserApi = api => {
  const { title, path, method, req_headers, desc } = api;

  const body = parseResBody(api);
  return {
    name: title,
    request: {
      // TODO: 变量动态化
      url: `{{baseUrl}}${path}`,
      method: method,
      header: parserHeader(req_headers),
      body,
      description: desc
    },
    // TODO: 补全response
    response: []
  };
};

const parseResBody = api => {
  const { req_body_type, req_body_other } = api;
  let mode = "";
  let body_data;
  if (req_body_type === "json" || req_body_type === "raw") {
    mode = "raw";
  } else if (req_body_type === "form") {
    // TODO: 未区分具体类型
    mode = "formdata";
  }
  if (req_body_other) {
    body_data = JSON.stringify(JSON.parse(req_body_other).properties);
  }
  return {
    mode,
    [mode]: body_data
  };
};

const parserHeader = req_headers =>
  req_headers.map(req_header => {
    const { name, value, desc } = req_header;
    return {
      key: name,
      name,
      value,
      description: desc
    };
  });
class exportController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.catModel = yapi.getInst(interfaceCatModel);
    this.interModel = yapi.getInst(interfaceModel);
    this.projectModel = yapi.getInst(projectModel);
    this.logModel = yapi.getInst(logModel);
  }

  async handleListClass(pid, status) {
    const result = await this.catModel.list(pid);
    const newResult = [];
    for (let i = 0, item, list; i < result.length; i += 1) {
      item = result[i].toObject();
      list = await this.interModel.listByInterStatus(item._id, status);
      list = list.sort((a, b) => a.index - b.index);
      if (list.length > 0) {
        item.list = list;
        newResult.push(item);
      }
    }

    return newResult;
  }

  async exportData(ctx) {
    const { pid } = ctx.request.query;
    const { status } = ctx.request.query;

    if (!pid) {
      ctx.body = yapi.commons.resReturn(null, 200, "pid 不为空");
    }
    let curProject;
    let tp = "";

    try {
      curProject = await this.projectModel.get(pid);
      // console.log(curProject)
      
      ctx.set("Content-Type", "application/octet-stream");
      const list = await this.handleListClass(pid, status);

      const data = handleExistId(list);

      // console.log(JSON.stringify(data));
      const log = await this.logModel.listWithPaging(pid, "project", 1, 10000);

      ctx.set('Content-Disposition', `attachment; filename=${encodeURI(`${curProject.name}-Postman`)}.json`);
      return (ctx.body = parser(data,curProject));
    } catch (error) {
      yapi.commons.log(error, 'error');
      ctx.body = yapi.commons.resReturn(null, 502, '下载出错');
    }
  }
}

module.exports = exportController;

function exportData(exportDataModule, pid) {
  exportDataModule.postman = {
    name: 'PostmanJSON',
    route: `/api/plugin/exportPostmanJSON?type=json&pid=${pid}`,
    desc: '导出项目接口文档为postman Collection v2文件'
  };
}

module.exports = function () {
  this.bindHook('export_data', exportData);
};

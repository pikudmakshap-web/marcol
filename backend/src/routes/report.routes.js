const express = require('express');
const { reportAccess } = require('../reports/reportAccess');
const { loadReport } = require('../reports/reportData');
const { workbook } = require('../reports/reportWorkbook');
const router=express.Router();
router.use(reportAccess);
router.get('/detailed',async(req,res,next)=>{try{return res.json(await loadReport(req.envPrisma,req.usersPrisma,req.reportEnvironment,req.query));}catch(e){next(e);}});
router.get('/export',async(req,res,next)=>{try{
    const report=await loadReport(req.envPrisma,req.usersPrisma,req.reportEnvironment,req.query);
    const buffer=workbook(report);
    res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition',`attachment; filename="marcol-report-${new Date().toISOString().slice(0,10)}.xlsx"`);
    return res.send(buffer);
}catch(e){next(e);}});
// Legacy report URLs keep their names but use the same manager-only, scoped pipeline.
router.get('/transactions',async(req,res,next)=>{try{return res.json(await loadReport(req.envPrisma,req.usersPrisma,req.reportEnvironment,{...req.query,mode:'transactions',from:req.query.from||req.query.startDate,to:req.query.to||req.query.endDate,walletIds:req.query.walletIds||req.query.walletId}));}catch(e){next(e);}});
router.get('/inventory',async(req,res,next)=>{try{return res.json(await loadReport(req.envPrisma,req.usersPrisma,req.reportEnvironment,{...req.query,mode:'inventory'}));}catch(e){next(e);}});
router.get('/wallet/:id',async(req,res,next)=>{try{return res.json(await loadReport(req.envPrisma,req.usersPrisma,req.reportEnvironment,{...req.query,mode:'wallets',walletIds:req.params.id}));}catch(e){next(e);}});
module.exports=router;

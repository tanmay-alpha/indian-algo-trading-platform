from fastapi import APIRouter, Depends, Request, HTTPException, Body

from backend.core.security import require_admin_token
from backend.portfolio.portfolio_engine import PortfolioEngine


router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/summary")
def portfolio_summary(request: Request):
    return _engine(request).get_summary()


@router.get("/positions", dependencies=[Depends(require_admin_token)])
def portfolio_positions(request: Request):
    return {"positions": _engine(request).get_positions()}


@router.get("/holdings", dependencies=[Depends(require_admin_token)])
def portfolio_holdings(request: Request):
    engine = _engine(request)
    return {
        "holdings": engine.get_holdings(),
        "summary": engine.holdings.get_summary(),
    }


@router.get("/equity-curve", dependencies=[Depends(require_admin_token)])
def portfolio_equity_curve(request: Request, limit: int = 500):
    return {"points": _engine(request).get_equity_curve(limit=limit)}


@router.get("/reconciliation/status", dependencies=[Depends(require_admin_token)])
def portfolio_reconciliation_status(request: Request):
    engine = _engine(request)
    mismatches = engine._last_position_mismatches + engine._last_holding_mismatches
    return {
        "positions": engine._last_position_mismatches,
        "holdings": engine._last_holding_mismatches,
        "summary": engine.reconciliation.summarize(mismatches),
    }


@router.post("/reconcile/orders", dependencies=[Depends(require_admin_token)])
async def portfolio_reconcile_orders(request: Request, broker_orders: list | None = Body(default=None)):
    execution_router = getattr(request.app.state, "execution_router", None)
    if not execution_router:
        raise HTTPException(status_code=500, detail="Execution router not initialized")

    if broker_orders is None:
        session_manager = getattr(request.app.state, "session_manager", None)
        smart_api = getattr(session_manager, "smart_api", None) if session_manager else None
        if session_manager and getattr(session_manager, "is_valid", False) and smart_api:
            try:
                import asyncio
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(None, smart_api.orderBook)
                if isinstance(response, dict):
                    data = response.get("data", [])
                    broker_orders = data if isinstance(data, list) else []
                else:
                    broker_orders = response if isinstance(response, list) else []
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"Failed to fetch broker order book: {str(e)}")
        else:
            raise HTTPException(status_code=501, detail="broker order-book fetch not configured")

    from backend.execution.reconciliation import OrderReconciliationEngine
    engine = OrderReconciliationEngine(
        order_store=execution_router.order_store,
        order_state_machine=execution_router.order_state_machine,
        event_bus=execution_router.event_bus,
    )

    report = engine.reconcile(broker_orders=broker_orders)
    updates_count = await engine.apply_broker_report(report, broker_orders=broker_orders)

    from dataclasses import asdict
    from backend.core.security import sanitize_response

    report_dict = asdict(report)
    response_data = {
        "status": "success",
        "updates_count": updates_count,
        "report": report_dict,
    }
    return sanitize_response(response_data)


def _engine(request: Request) -> PortfolioEngine:
    engine = getattr(request.app.state, "portfolio_engine", None)
    if engine is None:
        engine = PortfolioEngine()
        request.app.state.portfolio_engine = engine
    return engine


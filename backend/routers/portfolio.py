from fastapi import APIRouter, Request

from backend.portfolio.portfolio_engine import PortfolioEngine


router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/summary")
def portfolio_summary(request: Request):
    return _engine(request).get_summary()


@router.get("/positions")
def portfolio_positions(request: Request):
    return {"positions": _engine(request).get_positions()}


@router.get("/holdings")
def portfolio_holdings(request: Request):
    engine = _engine(request)
    return {
        "holdings": engine.get_holdings(),
        "summary": engine.holdings.get_summary(),
    }


@router.get("/equity-curve")
def portfolio_equity_curve(request: Request, limit: int = 500):
    return {"points": _engine(request).get_equity_curve(limit=limit)}


@router.get("/reconciliation/status")
def portfolio_reconciliation_status(request: Request):
    engine = _engine(request)
    mismatches = engine._last_position_mismatches + engine._last_holding_mismatches
    return {
        "positions": engine._last_position_mismatches,
        "holdings": engine._last_holding_mismatches,
        "summary": engine.reconciliation.summarize(mismatches),
    }


def _engine(request: Request) -> PortfolioEngine:
    engine = getattr(request.app.state, "portfolio_engine", None)
    if engine is None:
        engine = PortfolioEngine()
        request.app.state.portfolio_engine = engine
    return engine

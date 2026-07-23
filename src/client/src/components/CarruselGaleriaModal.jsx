// client/src/components/CarruselGaleriaModal.jsx
import React, { useState, useEffect } from 'react';
import './CarruselGaleriaModal.css';

export const CarruselGaleriaModal = ({ isOpen, onClose, fotos = [], indiceInicial = 0, nombrePersona = 'Familiar' }) => {
    const [indiceActual, setIndiceActual] = useState(indiceInicial);

    useEffect(() => {
        setIndiceActual(indiceInicial);
    }, [indiceInicial, isOpen]);

    if (!isOpen || fotos.length === 0) return null;

    const fotoActual = fotos[indiceActual] || {};

    const irAnterior = () => {
        setIndiceActual((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
    };

    const irSiguiente = () => {
        setIndiceActual((prev) => (prev === fotos.length - 1 ? 0 : prev + 1));
    };

    return (
        <div className="carrusel-modal-overlay" onClick={onClose}>
            <div className="carrusel-modal-container" onClick={(e) => e.stopPropagation()}>
                <button className="carrusel-btn-cerrar" onClick={onClose} title="Cerrar (Esc)">
                    <i className="bi bi-x-lg"></i>
                </button>

                <div className="carrusel-modal-body">
                    {/* Zona de imagen y navegación */}
                    <div className="carrusel-visor-imagen">
                        {fotos.length > 1 && (
                            <button className="carrusel-nav-btn prev" onClick={irAnterior}>
                                <i className="bi bi-chevron-left"></i>
                            </button>
                        )}

                        <div className="carrusel-imagen-wrapper">
                            <img
                                src={fotoActual.url}
                                alt={fotoActual.descripcion || `Foto de ${nombrePersona}`}
                                className="carrusel-imagen-principal"
                            />
                        </div>

                        {fotos.length > 1 && (
                            <button className="carrusel-nav-btn next" onClick={irSiguiente}>
                                <i className="bi bi-chevron-right"></i>
                            </button>
                        )}

                        <div className="carrusel-contador-badge">
                            {indiceActual + 1} / {fotos.length}
                        </div>
                    </div>

                    {/* Panel lateral de información */}
                    <div className="carrusel-info-panel">
                        <div className="carrusel-info-header">
                            <i className="bi bi-image text-primary"></i>
                            <h5>Galería de {nombrePersona}</h5>
                        </div>

                        <div className="carrusel-info-detalles">
                            {/* Fecha de Captura */}
                            <div className="carrusel-info-item">
                                <i className="bi bi-camera"></i>
                                <div>
                                    <span className="carrusel-label">Fecha de captura:</span>
                                    <p>{fotoActual.fechaCaptura || 'No especificada'}</p>
                                </div>
                            </div>

                            {/* Fecha de Publicación */}
                            <div className="carrusel-info-item">
                                <i className="bi bi-clock-history"></i>
                                <div>
                                    <span className="carrusel-label">Fecha de publicación:</span>
                                    <p>{fotoActual.fechaPublicacion ? new Date(fotoActual.fechaPublicacion).toLocaleDateString() : 'NOW'}</p>
                                </div>
                            </div>

                            {/* Quiénes Aparecen */}
                            {fotoActual.quienesAparecen && (
                                <div className="carrusel-info-item">
                                    <i className="bi bi-people"></i>
                                    <div>
                                        <span className="carrusel-label">Aparecen en la foto:</span>
                                        <p>{fotoActual.quienesAparecen}</p>
                                    </div>
                                </div>
                            )}

                            {/* Lugar */}
                            {fotoActual.lugar && (
                                <div className="carrusel-info-item">
                                    <i className="bi bi-geo-alt"></i>
                                    <div>
                                        <span className="carrusel-label">Lugar:</span>
                                        <p>{fotoActual.lugar}</p>
                                    </div>
                                </div>
                            )}

                            {/* Descripción */}
                            {fotoActual.descripcion && (
                                <div className="carrusel-info-item descripcion">
                                    <i className="bi bi-chat-left-quote"></i>
                                    <div>
                                        <span className="carrusel-label">Descripción:</span>
                                        <p>{fotoActual.descripcion}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Miniaturas inferiores */}
                        {fotos.length > 1 && (
                            <div className="carrusel-miniaturas-container">
                                {fotos.map((item, idx) => (
                                    <button
                                        key={item.id || idx}
                                        className={`carrusel-miniatura-item ${idx === indiceActual ? 'activa' : ''}`}
                                        onClick={() => setIndiceActual(idx)}
                                    >
                                        <img src={item.url} alt="miniatura" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};